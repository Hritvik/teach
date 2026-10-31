# Shared helper for the .githooks/* wrappers (docs/SETUP_BRANCH_PROTECTION.md).
#
# This repository sets `core.hooksPath` to `.githooks`, which replaces the
# machine's global hook path. The wrappers therefore forward each stage to the
# legacy hook directory (by default the ECC hooks at ~/.codex/git-hooks) so the
# secret scan and pre-push verification keep running instead of being silently
# skipped.

legacy_hooks_dir() {
    if [ -n "${TEACH_LEGACY_HOOKS:-}" ]; then
        printf '%s\n' "$TEACH_LEGACY_HOOKS"
        return 0
    fi

    local configured
    configured="$(git config --get teach.legacyHooksPath 2>/dev/null || true)"
    if [ -n "$configured" ]; then
        printf '%s\n' "$configured"
        return 0
    fi

    if [ -d "$HOME/.codex/git-hooks" ]; then
        printf '%s\n' "$HOME/.codex/git-hooks"
    fi
}

# run_legacy <hook> [git's own arguments...]
run_legacy() {
    local hook="$1"
    shift
    local hooks_dir
    hooks_dir="$(legacy_hooks_dir)"
    if [ -z "$hooks_dir" ] || [ ! -x "$hooks_dir/$hook" ]; then
        return 0
    fi
    "$hooks_dir/$hook" "$@"
}
