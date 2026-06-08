#!/usr/bin/env bash
# cc-worktree-bootstrap.sh — make the todoist-phase1 git worktree mount-independent and unblock git.
#
# RUN ONCE at the start of any Cowork session, before git ops in the worktree:
#     bash scripts/cc-worktree-bootstrap.sh
# Idempotent and safe to re-run.
#
# WHY THIS EXISTS
#   Cowork remounts the repo at a fresh /sessions/<name>/mnt/... path every session.
#   Git worktree pointers stored as ABSOLUTE paths therefore go stale across sessions and
#   block ALL git ops in the worktree ("fatal: not a git repository"). We instead store them
#   RELATIVE (no mount in the path), which is mount-independent and never goes stale.
#   Proven on git 2.34.1 — the sandbox git, which is separate from your Windows git, so a
#   machine git upgrade does NOT change what runs here and is not required.
#
#   Separately, the drvfs mount that backs the Windows drive cannot unlink() some files
#   ("Operation not permitted"), so stale *.lock files can linger and block commits. rm does
#   NOT work on them; mv (atomic rename) DOES. This script clears them with mv.
#
# WHAT IT DOES (both are no-ops if already correct):
#   1. Writes the two worktree pointers as relative paths.
#   2. Clears stale index/HEAD locks via mv.
set -u
# This script ships INSIDE the worktree at <worktree>/scripts/, so dirname/.. IS the worktree root.
WT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$WT/../.." && pwd)"          # .worktrees/<id> sits two levels under the repo root
GD="$REPO/.git/worktrees/todoist-phase1"

if [ ! -d "$WT" ] || [ ! -d "$GD" ]; then
  echo "cc-worktree-bootstrap: ERROR — worktree or gitdir missing:"
  echo "  worktree: $WT"
  echo "  gitdir:   $GD"
  exit 1
fi

# 1) Relative, mount-independent pointers (fixed repo layout: .worktrees/<id> beside .git).
printf 'gitdir: ../../.git/worktrees/todoist-phase1\n' > "$WT/.git"
printf '../../../.worktrees/todoist-phase1/.git\n'     > "$GD/gitdir"

# 2) Clear stale locks (mv works on drvfs; rm/unlink does not). Fixed target name => no clutter buildup.
for f in index.lock HEAD.lock ORIG_HEAD.lock; do
  if [ -e "$GD/$f" ]; then
    mv -f "$GD/$f" "$GD/$f.stale" 2>/dev/null && echo "cc-worktree-bootstrap: cleared stale $f"
  fi
done

# 3) Verify git can now resolve the worktree.
if git -C "$WT" rev-parse --short HEAD >/dev/null 2>&1; then
  echo "cc-worktree-bootstrap: OK — $(git -C "$WT" rev-parse --abbrev-ref HEAD) @ $(git -C "$WT" rev-parse --short HEAD)"
else
  echo "cc-worktree-bootstrap: pointers written but git still can't resolve HEAD; inspect $WT/.git"
  exit 1
fi
