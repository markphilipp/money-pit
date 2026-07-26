# Tooling, CI & deploy

## Package manager

**bun**, pinned to 1.3.9 in CI; Vercel picks it up from `bun.lock`. `bun.lock` is the only lockfile — `package-lock.json`,
`yarn.lock` and `pnpm-lock.yaml` are gitignored so a stray `npm install` can't be committed. Scripts
that shell out use `bunx` (`start`, the Playwright web server). `trustedDependencies` in
`package.json` allows `unrs-resolver`'s postinstall.

## Git worktrees

Worktrees are checked out under `.worktrees/` (also gitignored). Every tool has to be told to skip
nested checkouts, or a worktree's copy of the tree gets linted/typechecked/tested twice:

| Tool       | Exclusion                                                     |
| ---------- | ------------------------------------------------------------- |
| eslint     | `ignores: '**/.worktrees/**', '**/worktrees/**'`              |
| tsconfig   | `exclude: ["**/.worktrees", "**/worktrees"]`                  |
| vitest     | `exclude: [...configDefaults.exclude, '**/.worktrees/**', …]` |
| prettier   | `.worktrees`, `worktrees` in `.prettierignore`                |
| playwright | `testDir: './e2e'` only — **no `testIgnore`**                 |

The Playwright exception matters: its ignore patterns match absolute paths, so
`'**/.worktrees/**'` would make a checkout that itself lives under `.worktrees/` find zero tests.
`testDir` alone already scopes discovery correctly.

## CI — `.github/workflows/ci.yml`

Runs on every PR and on push to `main`:

- **quality** — matrix of `lint`, `typecheck`, `test` (`fail-fast: false`, so all three report).
- **build** — `bun run build`, uploads `.next` (minus `.next/cache`) as the `next-build` artifact.
  It needs `include-hidden-files: true`: `.next` is a dot-directory and `upload-artifact` skips
  hidden files by default, which uploads nothing and merely _warns_ — a green build job with no
  artifact, failing only in `e2e`. `if-no-files-found: error` makes that fail where it happens.
- **e2e** — downloads that artifact, caches browsers keyed on `bun.lock`, installs chromium via
  `bunx playwright install --with-deps`, runs `bun run e2e` (which boots `next start`); uploads the
  report on failure.

## Deploy — Vercel

Git-connected, no config file. Vercel's Next.js preset auto-detects the framework, installs with
bun (it sees `bun.lock`) and runs `bun run build` — so there is no `vercel.json` and no build
overrides to keep in sync. No environment variables. `main` auto-deploys to production; every PR
gets a preview URL commented on GitHub.

This is a **serverful** deployment: `/` , `/rules` and `/rules/new` are prerendered, `/rules/[id]`
is server-rendered on demand, and `not-found.tsx` returns a real 404 status. The server renders
markup only — it is handed no statement data and has nothing to store.

CI/CD stays split: GitHub Actions is the quality gate (lint/typecheck/test/e2e), Vercel only builds
and deploys.

### Production gate — `.github/workflows/vercel-gate.yml`

Vercel builds every push, but **Deployment Checks** hold the build back from the production alias
until a named check reports green. The wiring:

1. Vercel finishes a build and fires a `vercel.deployment.success` repository dispatch.
2. `vercel-gate.yml` picks it up and runs Playwright against the deployment URL — `E2E_BASE_URL`
   makes `playwright.config.ts` skip its local `next start` and target the live site instead.
3. `vercel/repository-dispatch/actions/status@v1` reports the result back as
   `Vercel - money-pit: e2e`.
4. Vercel promotes to `money-pit.vercel.app` only if that check passed.

The status action is the **first** step in the job, not the last. Its `main` entry point marks the
commit status pending and its `post` hook reports the job's real conclusion; run it late and there
is a window where Vercel sees no pending check and can promote early. It reads the target commit
from `client_payload.git.sha` and lists the run's jobs to derive its conclusion, so the workflow
needs `statuses: write` **and** `actions: read`. If `git.sha` is ever absent it logs a warning and
skips the status update silently — a green run that reported nothing looks the same as no run.

The dispatch payload looks like this:

```json
{
  "id": "dpl_…",
  "url": "https://money-2eqqlt1e0-markphilipp.vercel.app",
  "alias": ["money-pit.vercel.app", "money-pit-git-main-markphilipp.vercel.app"],
  "environment": "production",
  "target": "production",
  "type": "success",
  "git": { "ref": "main", "sha": "…", "shortSha": "…" },
  "project": { "id": "prj_…", "name": "money-pit" }
}
```

The gate tests `url`, not `alias`. The alias still resolves to the _previous_ build until promotion,
so testing it would pass on the old code every time.

`ssoProtection` is `all_except_custom_domains`, so that deployment URL 302s to Vercel SSO. The gate
gets in with an automation bypass secret, stored as the `VERCEL_AUTOMATION_BYPASS_SECRET` repo
secret and sent by `playwright.config.ts` as an `x-vercel-protection-bypass` header. Rotate it with
`vercel project protection enable money-pit --protection-bypass`, then update the GitHub secret.

This gate deliberately runs e2e only — `lint`, `typecheck` and `test` already have to pass before a
commit can reach `main` (see the ruleset below), so the thing worth re-checking post-build is
whether the deployed artifact actually works.

The check has to report **once** before it can be selected under Project → Settings → Build and
Deployment → Deployment Checks → Add Checks → GitHub. Until it's selected there, the gate runs and
reports but doesn't block anything. Requiring a check that never reports would stall production
promotion indefinitely, so add it only after a green run.

`main` is protected by a repository ruleset requiring `lint`, `typecheck`, `test`, `build` and
`e2e`, and blocking force-push and deletion. Repository admins are bypass actors in `always` mode,
so an emergency fix can go straight to `main` — the normal path is still a PR.

## Config notes

- `next.config.ts` — no `output` setting (a serverful build) plus the production security headers.
  The CSP's `connect-src 'self'` is what makes "no network calls" enforced rather than merely
  intended; it cannot be `'none'` because client-side navigation fetches RSC payloads. Headers are
  skipped outside production so dev keeps its HMR websocket.
- Next infers the workspace root as the parent repo, because `node_modules` lives there and
  worktrees don't get their own. That warning is expected in a worktree — **don't** "fix" it with
  `turbopack.root`, which breaks module resolution for exactly that reason.
- `@/*` maps to `src/*` in both `tsconfig.json` and `vitest.config.ts`.
- Prettier ignores `prototype`, `playwright-report`, `test-results`, `bun.lock`, worktrees.
- `CLAUDE.md` is a single `@AGENTS.md` reference and is committed; keep the content in `AGENTS.md`.
