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
- **e2e-signed-in** — same setup, then creates a Neon branch `ci-<run id>-<attempt>` off `dev` with
  `neondatabase/create-branch-action`, runs `db:migrate` against it, generates a masked
  `BETTER_AUTH_SECRET`, and runs `bun run e2e:signed-in` on the pooled URL.
  `neondatabase/delete-branch-action` removes the branch under `if: always()`, and the branch's
  `expires_at` (two hours out) is the backstop if that step never runs. It branches off `dev`, not
  `main`, so production data never reaches CI. It needs the `NEON_API_KEY` repo secret and the
  `NEON_PROJECT_ID` repo variable, and is skipped while the variable is unset.

## Deploy — Vercel

Git-connected, no config file. Vercel's Next.js preset auto-detects the framework, installs with
bun (it sees `bun.lock`) and runs the `vercel-build` script, which `@vercel/next` prefers over
`build` — so there is no `vercel.json` and no build overrides to keep in sync. `main` auto-deploys
to production; every PR gets a preview URL commented on GitHub.

This is a **serverful** deployment. Every route is server-rendered on demand, because the root
layout reads the session cookie, and `not-found.tsx` returns a real 404 status. Signed out, the
server renders markup only and is handed no statement data. Signed in, server actions in
`src/app/actions/` store the user's statements, rules, overrides and preferences in Neon.

The Vercel Neon integration injects `DATABASE_URL` (pooled, `-pooler` host) for the app and
`DATABASE_URL_UNPOOLED` (direct) for `drizzle-kit`. Preview and Production use the Neon `main`
branch. Development's two URLs are set by hand to the Neon `dev` branch, and the integration's other
`PG*`/`POSTGRES_*` vars have no Development target, so a local shell can't reach production. Locally,
`bunx vercel env pull .env.local` (pull into a fresh file: `pull` keeps keys it no longer serves).
`src/db` reads the env on first query, not at import, so `bun run build` needs no database.

### Migrations run in the production build

`vercel-build` runs `bun run db:migrate` before `next build` when `VERCEL_ENV=production`, and
plain `next build` otherwise. A GitHub Actions job can't be ordered against Vercel's build, so this
is the only place a migration is guaranteed to land before the code that needs it. Local and CI
`bun run build` stay DB-free. Preview deploys share the production database and never migrate it.

The old deployment keeps serving while the new build migrates, and a failed build leaves the
migration applied. So every migration is **expand/contract**: add columns nullable or with a
default, ship the writer, backfill, and only then tighten or drop in a later deploy. Never add a
`NOT NULL` column without a default in the same deploy as its first writer.

Schema lives in `src/db/schema/`. Better Auth owns `auth.ts`: regenerate it with
`bun run auth:generate` (it reads `scripts/auth-cli.config.ts`, because the CLI needs an exported
instance and the app's is lazy), then `bun run db:generate --name <change>` and commit the SQL in
`drizzle/`.

### Auth env

| Var                                         | Purpose                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | Signs session cookies. Per environment; never shared.                |
| `BETTER_AUTH_URL`                           | Canonical origin for OAuth callbacks.                                |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in. A provider missing either is disabled, not an error. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub sign-in, same rule.                                           |

The `/privacy` page makes promises this config keeps. Better Auth `databaseHooks` drop provider
names, avatars and tokens, and the IP address and user agent Better Auth records on each session by
default (`bun run auth:check` asserts both). The page also quotes Neon's 6-hour history retention.
Change any of these and the page changes with them.

`src/auth` builds the Better Auth instance on first request, like `getDb()`, so `next build` needs
none of these. OAuth callbacks work on production and localhost only, not rotating preview URLs.

Node is pinned to 24 (the newest Vercel supports): `engines.node` for Vercel, `.node-version` for
fnm locally and `actions/setup-node` in CI. The Neon driver relies on the runtime's global
`WebSocket`; there is no `ws` dependency.

CI/CD stays split: GitHub Actions is the quality gate (lint/typecheck/test/e2e), Vercel only builds
and deploys.

`main` is protected by a repository ruleset requiring `lint`, `typecheck`, `test`, `build` and
`e2e`, and blocking force-push and deletion. Repository admins are bypass actors in `always` mode,
so an emergency fix can go straight to `main` — the normal path is still a PR.

## Config notes

- `next.config.ts` — no `output` setting (a serverful build) plus the production security headers.
  The CSP's `connect-src 'self'` is what makes "no third-party calls" enforced rather than merely
  intended; it cannot be `'none'` because client-side navigation fetches RSC payloads. Headers are
  skipped outside production so dev keeps its HMR websocket.
- Next infers the workspace root as the parent repo, because `node_modules` lives there and
  worktrees don't get their own. That warning is expected in a worktree — **don't** "fix" it with
  `turbopack.root`, which breaks module resolution for exactly that reason.
- `@/*` maps to `src/*` in both `tsconfig.json` and `vitest.config.ts`.
- Prettier ignores `prototype`, `playwright-report`, `test-results`, `bun.lock`, worktrees.
- `CLAUDE.md` is a single `@AGENTS.md` reference and is committed; keep the content in `AGENTS.md`.
