# Working on DiffWitness

## Current state

This repository is an initial scaffold. No application language, framework,
package manager, runtime version, or application behavior has been selected.
Use the user's feature requirements to choose the implementation when needed.

## Setup and checks

- Run `bash scripts/cloud-setup.sh` from any working directory to verify the
  repository and baseline tools. It installs no dependencies and needs no secrets.
- After editing shell scripts, run `bash -n scripts/cloud-setup.sh`.
- There are currently no application tests or build commands. Report this
  explicitly; a successful setup check is not an application test pass.
- When adding application code, document and run the relevant installation,
  build, and test commands, and update the cloud setup accordingly.
- Keep cloud setup noninteractive, repeatable, and compatible with Linux. Do not
  depend on a developer's home directory, macOS tools, or a running local service.

## Repository practices

- Preserve the Apache 2.0 license.
- Keep generated files, dependency directories, credentials, and local environment
  files out of Git. Commit dependency lockfiles when a package manager is added.
- Use `codex/` as the prefix for new development branches unless requested otherwise.
- Keep the README accurate about what is implemented and how to run it.
