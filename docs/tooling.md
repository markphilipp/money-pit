# Tooling, CI & deploy

## Package manager

**bun**, pinned to 1.3.9 in CI and Netlify. `bun.lock` is the only lockfile — `package-lock.json`,
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

## Deploy — `netlify.toml`

Netlify builds `bun run build` and publishes `out/`. No environment variables. `main` auto-deploys
and every PR gets a preview. The static export ships its own `404.html`, and a single-route app
needs no redirect rules.

## Config notes

- `next.config.ts` — `output: 'export'`; there is no server, no image optimization at runtime.
- `@/*` maps to `src/*` in both `tsconfig.json` and `vitest.config.ts`.
- Prettier ignores `prototype`, `playwright-report`, `test-results`, `bun.lock`, worktrees.
- `CLAUDE.md` is a single `@AGENTS.md` reference and is committed; keep the content in `AGENTS.md`.
