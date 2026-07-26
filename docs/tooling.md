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
