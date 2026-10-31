# Branch protection setup

Teach uses the same GitHub Flow as MyFitnessGuide: `main` is always deployable, every change lands
through a pull request, and the capture deploy gate runs only from a clean `main` tree.

GitHub's server-side branch protection requires **GitHub Pro** for a private repository on a free
account. This repository is private, so the rules are enforced in two free layers:

1. **Local Git hooks** — refuse direct commits to `main`, warn on branch naming, and forward to the
   machine's secret-scan and pre-push verification hooks.
2. **GitHub Actions CI** — run typecheck, tests and the capture build on every pull request and on
   `main`.

The remaining rules are manual discipline, documented in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Install the local hooks once per clone

```sh
git config --local teach.legacyHooksPath "$(git config --global --get core.hooksPath || printf '%s' "$HOME/.codex/git-hooks")"
git config --local core.hooksPath .githooks
```

`core.hooksPath` replaces the machine's global hook path. The wrappers in `.githooks/` forward each
stage to `teach.legacyHooksPath` (the ECC hooks at `~/.codex/git-hooks` by default), so the secret scan
and the typecheck/test/build pre-push flow keep running. Set `TEACH_LEGACY_HOOKS` to point at a
different hook directory, or leave it unset if there is no global hook manager.

### What the hooks enforce

| Hook | Behaviour |
|---|---|
| `pre-commit` | Refuses a direct commit on `main` unless it concludes a merge. Warns on non-conventional branch names, package/deployment changes and migration changes. Then runs the legacy secret scan. |
| `pre-merge-commit` | Runs the legacy secret scan on a clean merge before it lands. |
| `pre-push` | Runs the legacy pre-push checks (typecheck, tests, build). |

Bypass only for a finding the change did not cause, and say why in the commit message:

```sh
ECC_SKIP_PRECOMMIT=1 git commit ...   # secret scan only
git commit --no-verify ...            # all local hooks; avoid
```

The deploy gate is separate and never bypassed by a hook flag:

```sh
npm run deploy:check   # every check, no Cloudflare change
npm run deploy         # checks, migrations, deploy, verify
```

## Desired GitHub rules for `main`

If the repository moves to GitHub Pro or becomes public, enable:

- Require a pull request before merging.
- Require one approval; dismiss stale approvals on new commits.
- Require the `check` status from `.github/workflows/ci.yml`.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion.
- Do not allow bypassing the rules.

Enable them from the repository settings, or with the API once the plan allows it:

```sh
gh api --method PUT repos/Hritvik/teach/branches/main/protection \
  --input docs/branch-protection.json
```

`docs/branch-protection.json` is the desired payload. The `check` job name in that payload must match
the job in `.github/workflows/ci.yml`.

## Why `main` is protected

The capture Worker is deployed from a clean `main` tree. A direct commit can bypass the review that
the release evidence and migrations depend on. The local hook blocks that, CI re-runs the checks on
the pull request, and `npm run deploy` refuses a dirty tree.
