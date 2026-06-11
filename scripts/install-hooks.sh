#!/bin/sh
# One-time setup per clone: point git at the committed githooks/ directory so the
# pre-push integrity gate runs automatically. Run this once on each machine that
# pushes (e.g. your local machine): `sh scripts/install-hooks.sh`
repo="$(git rev-parse --show-toplevel)" || { echo "not a git repo"; exit 1; }
cd "$repo" || exit 1
git config core.hooksPath githooks
chmod +x githooks/* 2>/dev/null || true
echo "Installed: core.hooksPath=githooks"
echo "pre-push will now run 'node verify-dist.js' and block stale/corrupt deploys."
