#!/usr/bin/env bash
# publish-dots.sh — stage npm publishing for every ~/dots owned submodule.
#
# Flow (called by `make publish` in ~/development):
#   1. check ~/dots is clean; dirty is only tolerable when it is submodule
#      gitlink drift ("new commits") — real file changes terminate
#   2. push unpushed commits in every owned submodule (akinevz2 origin + package.json)
#   3. re-check ~/dots; if a commit there is now necessary, terminate
#   4. synchronise each submodule into ~/development/system/<name> (clone or hard-reset)
#   5. publish-needed check: local package.json version vs `npm view` —
#      only packages AHEAD of the registry get a session (equal = up to
#      date; registry-ahead would be rejected anyway; no registry entry
#      = deliberate first-publish, skipped)
#   6. spawn an interactive session per publish-needed directory via
#      launch_alacritty
#
# Usage: publish-dots.sh [--dry-run] [--no-spawn] [--all]
#   --dry-run    print actions without pushing/cloning/resetting/spawning
#   --no-spawn   skip step 6 (used by tests and CI-ish runs)
#   --all        open EVERY owned package directory (step 5 verdict ignored)

set -euo pipefail

DOTS=${DOTS:-"$HOME/dots"}
SYSTEM=${SYSTEM:-"$HOME/development/system"}

DRY_RUN=0
SPAWN=1
ALL=0
for arg in "$@"; do
    case $arg in
        --dry-run)  DRY_RUN=1 ;;
        --no-spawn) SPAWN=0 ;;
        --all)      ALL=1 ;;
        *) echo "publish-dots: unknown option: $arg" >&2; exit 2 ;;
    esac
done

die() { echo "publish-dots: TERMINATING — $*" >&2; exit 1; }
run() { if [ "$DRY_RUN" = 1 ]; then echo "  [dry-run] $*"; else "$@"; fi; }

[ -d "$DOTS/.git" ] || die "$DOTS is not a git repository"
command -v launch_alacritty >/dev/null 2>&1 || die "launch_alacritty not on PATH"

# ── collect owned npm packages ───────────────────────────────────────────────
# Owned = dots submodule whose origin is an akinevz2 repo and which ships a package.json.
# Upstream submodules (e.g. bat-src from sharkdp/bat) are skipped.
paths=(); names=(); urls=(); shas=()
while IFS= read -r line; do
    key=${line%% *}
    url=${line#* }
    case $url in *akinevz2*) ;; *) continue ;; esac
    path=$(git -C "$DOTS" config --file .gitmodules --get "${key%.url}.path")
    dir="$DOTS/$path"
    [ -f "$dir/package.json" ] || continue
    paths+=("$path")
    names+=("$(basename "$path")")
    urls+=("$url")
    shas+=("$(git -C "$dir" rev-parse HEAD)")
done < <(git -C "$DOTS" config --file .gitmodules --get-regexp '^submodule\..*\.url$')
[ ${#names[@]} -gt 0 ] || die "no owned npm submodules found in $DOTS"

echo "Owned packages: ${names[*]}"

# ── 1. ~/dots cleanliness ────────────────────────────────────────────────────
if dirty=$(git -C "$DOTS" status --porcelain) && [ -n "$dirty" ]; then
    blocking=""
    while IFS= read -r line; do
        [ -n "$line" ] || continue
        path=${line#???}                      # strip the XY status columns
        allowed=0
        for sp in "${paths[@]}"; do
            [ "$path" = "$sp" ] && { allowed=1; break; }   # gitlink drift is fine
        done
        [ "$allowed" = 1 ] || blocking+="  $line"$'\n'
    done <<EOF
$dirty
EOF
    if [ -n "$blocking" ]; then
        die "uncommitted changes in ~/dots (not safe to publish):
$blocking"
    fi
    echo "~/dots: dirty only via submodule gitlinks — safe to push submodule commits"
else
    echo "~/dots: clean"
fi

# ── 2. push unpushed commits in every submodule ──────────────────────────────
for i in "${!names[@]}"; do
    dir="$DOTS/${paths[$i]}"
    name=${names[$i]}
    if st=$(git -C "$dir" status --porcelain --untracked-files=no) && [ -n "$st" ]; then
        die "submodule $name has uncommitted tracked changes:
$st"
    fi
    branch=$(git -C "$dir" branch --show-current)
    [ -n "$branch" ] || die "submodule $name is on a detached HEAD"
    if [ "$DRY_RUN" = 1 ]; then
        echo "  [dry-run] $name: would push unpushed commits on $branch"
        continue
    fi
    git -C "$dir" fetch --quiet origin "$branch"
    if ! git -C "$dir" rev-parse --verify --quiet "origin/$branch" >/dev/null; then
        echo "  $name: no upstream yet — pushing $branch (-u)"
        git -C "$dir" push -u origin "$branch"
    else
        n=$(git -C "$dir" rev-list --count "origin/$branch..$branch")
        if [ "$n" -gt 0 ]; then
            echo "  $name: pushing $n unpushed commit(s) on $branch"
            git -C "$dir" push origin "$branch"
        else
            echo "  $name: nothing to push"
        fi
    fi
done

# ── 3. re-check ~/dots — a needed commit terminates the flow ─────────────────
if dirty=$(git -C "$DOTS" status --porcelain) && [ -n "$dirty" ]; then
    die "creating a commit in ~/dots is necessary (gitlink bump):
$dirty
Commit & push ~/dots first, then re-run make publish."
fi
echo "~/dots: still clean"

# ── 4. synchronise submodules into system ────────────────────────────────────
for i in "${!names[@]}"; do
    name=${names[$i]}
    sha=${shas[$i]}
    branch=$(git -C "$DOTS/${paths[$i]}" branch --show-current)
    target="$SYSTEM/$name"
    if [ ! -d "$target/.git" ]; then
        echo "  system/$name: cloning from ${urls[$i]}"
        run git clone --quiet "${urls[$i]}" "$target"
    else
        run git -C "$target" fetch --quiet origin
    fi
    # aim the clone at exactly the commit dots' submodule records
    if [ "$DRY_RUN" = 1 ]; then
        echo "  [dry-run] system/$name: would check out $branch @ ${sha:0:7}"
    elif git -C "$target" rev-parse --verify --quiet "origin/$branch" >/dev/null && \
         [ "$(git -C "$target" rev-parse "origin/$branch")" = "$sha" ]; then
        git -C "$target" checkout --quiet -B "$branch" "origin/$branch"
        echo "  system/$name: synced to $branch @ ${sha:0:7}"
    else
        git -C "$target" checkout --quiet --detach "$sha"
        echo "  system/$name: detached at ${sha:0:7} (not tip of $branch)"
    fi
done

# ── 5. publish-needed check: local version vs npm registry ──────────────────
# Only packages whose local version is ahead of the registry get a
# session. Equal = up to date. Registry-ahead is an anomaly (publish
# would be rejected for the same version). No registry entry at all is
# a deliberate first-publish decision — skipped, surfaced loudly. Any
# non-404 npm failure is a loud terminate (a silent skip could hide a
# pending publish). --all ignores the verdicts entirely.
errf=$(mktemp "${TMPDIR:-/tmp}/publish-dots-npmerr.XXXXXX")
trap 'rm -f "$errf"' EXIT
needed=()
echo "publish check:"
for i in "${!names[@]}"; do
    dir="$DOTS/${paths[$i]}"
    name=${names[$i]}
    local_v=$(node -p "require('$dir/package.json').version")
    if [ "$ALL" = 1 ]; then
        echo "  $name: $local_v — --all: opening regardless"
        needed+=("$i")
        continue
    fi
    if reg_v=$(npm view "$name" version 2>"$errf"); then
        if [ "$local_v" = "$reg_v" ]; then
            echo "  $name: $local_v = registry — up to date"
        elif [ "$(printf '%s\n' "$reg_v" "$local_v" | sort -V | head -n1)" = "$reg_v" ]; then
            echo "  $name: $local_v > registry $reg_v — PUBLISH NEEDED"
            needed+=("$i")
        else
            echo "  $name: $local_v < registry $reg_v — registry ahead, publish would be rejected; skipping"
        fi
    elif grep -q "E404" "$errf"; then
        echo "  $name: $local_v — no npm registry entry, skipping (--all to open anyway)"
    else
        die "npm view $name failed: $(cat "$errf")"
    fi
done

# ── 6. spawn one interactive session per publish-needed directory ───────────
if [ "$SPAWN" = 0 ]; then
    echo "publish-dots: skipping session spawn (--no-spawn)"
    exit 0
fi
if [ "${#needed[@]}" -eq 0 ]; then
    echo "publish-dots: nothing to publish — no sessions spawned"
    exit 0
fi
targets=()
for i in "${needed[@]}"; do
    targets+=("$SYSTEM/${names[$i]}")
done
if [ "$DRY_RUN" = 1 ]; then
    echo "  [dry-run] would spawn sessions in:"
    printf '    %s\n' "${targets[@]}"
    exit 0
fi
echo "publish-dots: spawning sessions in:"
printf '  %s\n' "${targets[@]}"
pids=()
for d in "${targets[@]}"; do
    launch_alacritty --urgent --no-distract "cd '$d' && exec bash -l" &
    pids+=($!)
done
wait
echo "publish-dots: done — npm publish away"
