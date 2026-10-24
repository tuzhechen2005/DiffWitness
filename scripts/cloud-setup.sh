#!/usr/bin/env bash
set -euo pipefail

# Resolve relative to this file, so cloud setup does not depend on its caller's cwd.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$repo_root"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: Node.js 20+ is required.' >&2
  exit 1
fi

npm ci --no-audit --no-fund
node --version
printf '%s\n' 'DiffWitness dependencies installed. Run: npm run typecheck && npm test'
