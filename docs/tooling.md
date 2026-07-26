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
- **build** — `bun run build`, uploads `out/` as the `static-export` artifact.
- **e2e** — downloads that artifact, caches browsers keyed on `bun.lock`, installs chromium via
  `bunx playwright install --with-deps`, runs `bun run e2e`; uploads the report on failure.

## Deploy — Vercel

Git-connected, no config file. Vercel's Next.js preset auto-detects the framework, installs with
bun (it sees `bun.lock`), runs `bun run build` and publishes the static export from `out/` — so
there is no `vercel.json` and no build overrides to keep in sync. No environment variables. `main`
auto-deploys to production; every PR gets a preview URL commented on GitHub. The static export
ships its own `404.html`, and a single-route app needs no redirect rules.

CI/CD stays split: GitHub Actions is the quality gate (lint/typecheck/test/e2e), Vercel only builds
and deploys.

### Production gate — `.github/workflows/vercel-gate.yml`

Vercel builds every push, but **Deployment Checks** hold the build back from the production alias
until a named check reports green. The wiring:

1. Vercel finishes a build and fires a `vercel.deployment.success` repository dispatch.
2. `vercel-gate.yml` picks it up and runs Playwright against the deployment URL — `E2E_BASE_URL`
   makes `playwright.config.ts` skip its local `bunx serve out` and target the live site instead.
3. `vercel/repository-dispatch/actions/status@v1` reports the result back as
   `Vercel - money-pit: e2e`.
4. Vercel promotes to `money-pit.vercel.app` only if that check passed.

This gate deliberately runs e2e only — `lint`, `typecheck` and `test` already have to pass before a
commit can reach `main` (see the ruleset below), so the thing worth re-checking post-build is
whether the deployed artifact actually works.

The check has to report **once** before it can be selected under Project → Settings → Build and
Deployment → Deployment Checks → Add Checks → GitHub. Until it's selected there, the gate runs and
reports but doesn't block anything. Requiring a check that never reports would stall production
promotion indefinitely, so add it only after a green run.

`main` is protected by a repository ruleset requiring `lint`, `typecheck`, `test`, `build` and
`e2e`, and blocking force-push and deletion. There are no bypass actors.

If server code ever arrives — route handlers, server actions, middleware — drop `output: 'export'`
and `images: { unoptimized: true }` from `next.config.ts`; the same Vercel project then builds a
serverful deployment with no other changes.

## Config notes

- `next.config.ts` — `output: 'export'`; there is no server, no image optimization at runtime.
- `@/*` maps to `src/*` in both `tsconfig.json` and `vitest.config.ts`.
- Prettier ignores `prototype`, `playwright-report`, `test-results`, `bun.lock`, worktrees.
- `CLAUDE.md` is a single `@AGENTS.md` reference and is committed; keep the content in `AGENTS.md`.
