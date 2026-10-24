# DiffWitness

Find inputs where your refactor changed behavior: a local open-weight model (Gemma 4) proposes them, real execution proves them.

Work in progress for MadCloud x MLH Hacktoberfest Hack Day 2026.

## Development

```bash
git clone https://github.com/tuzhechen2005/DiffWitness.git
cd DiffWitness
bash scripts/cloud-setup.sh   # npm ci
npm run typecheck && npm test
```

Codex Cloud: use `bash scripts/cloud-setup.sh` as the environment's install command (no secrets or services needed).

## License

[Apache License 2.0](LICENSE).
