#!/usr/bin/env bash
set -euo pipefail

# Resolve relative to this file, so cloud setup does not depend on its caller's cwd.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$repo_root"

if ! command -v git >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: Git is required in the development environment.' >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: Run setup from a Git checkout of DiffWitness.' >&2
  exit 1
fi

for required_file in README.md AGENTS.md LICENSE; do
  if [[ ! -f "$required_file" ]]; then
    printf 'ERROR: Missing repository file: %s\n' "$required_file" >&2
    exit 1
  fi
done

printf '%s\n' 'DiffWitness baseline development environment is ready.'
git --version
printf '%s\n' \
  'No application dependencies or services are configured yet.' \
  'No application tests or build commands exist yet.' \
  'Update this script when the application stack is added.'
