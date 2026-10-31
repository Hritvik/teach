# Contributing to Teach

## Branch strategy

This repository uses GitHub Flow:

- `main` is the canonical, always-deployable branch.
- Work happens on feature branches and lands through a pull request.
- Branch names use `feat/`, `fix/`, `docs/`, `test/`, `refactor/` or `chore/` followed by a short slug.

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/your-change
```

## Before opening a pull request

Use Node.js 26 and npm 11 from the repository root:

```sh
npm ci
npm run check
npm run build:capture
npm run deploy:check
```

`npm run check` runs strict type checking and the unit/integration/MCP suites with 80% coverage
thresholds. `npm run deploy:check` additionally verifies the reviewed capture release evidence. Both
must pass before merge.

Commit messages use conventional commits, for example:

```text
feat(capture): keep inquiry receipts across reconnects
fix(auth): refuse an owner mismatch before creating a grant
docs(deploy): record the capture verification steps
```

## Local hooks

Install the branch-protection hooks once per clone:

```sh
git config --local teach.legacyHooksPath "$(git config --global --get core.hooksPath || printf '%s' "$HOME/.codex/git-hooks")"
git config --local core.hooksPath .githooks
```

The `pre-commit` hook refuses direct commits to `main` and forwards to the machine's secret scan. The
`pre-push` hook forwards to the machine's typecheck/test/build checks. See
[docs/SETUP_BRANCH_PROTECTION.md](docs/SETUP_BRANCH_PROTECTION.md) for the rules and the bypass policy.

## Pull requests

- Explain what changed, why, and which release gate it affects.
- Link the spec, plan or decision it implements.
- Keep the capture/full boundary intact. Do not add grading, spaced review or scheduled inference to
  `src/capture.ts`.
- Do not include credentials, `.state/`, local databases or generated bundles.

Merge with a merge commit. Do not squash unless the branch is a single self-contained commit.

## Deployment

Capture deployment is operator-gated:

```sh
npm run deploy
```

The gate refuses a dirty tree, runs the full check suite, rebuilds the capture bundle, verifies
`.state/deploy/capture-approval.json`, applies additive D1 migrations and then deploys. Afterward it
checks `/health`, the `/mcp` OAuth challenge and the protected-resource metadata.

The full tutor release is not deployed by this command. It stays behind the gates in
`docs/superpowers/plans/2026-10-26-teach-general-build.md`.

## Secrets

- Never commit `GOOGLE_CLIENT_SECRET`, `CONTROL_SESSION_SECRET`, tokens, `.state/` or `.dev.vars`.
- Non-secret deployment identity belongs in `app/worker/wrangler.capture.jsonc`.
- Ask before creating Cloudflare resources, rotating credentials or changing the Google/Access setup.
