# DiffWitness

DiffWitness is at the initial repository stage. The application, language, and
dependency manager have not been selected yet.

## Development

```bash
git clone https://github.com/tuzhechen2005/DiffWitness.git
cd DiffWitness
bash scripts/cloud-setup.sh
```

The setup command checks the repository and required baseline tools. There are
currently no application dependencies, build commands, or application tests.

## Codex Cloud

Create a reusable environment with these settings:

| Setting | Value |
| --- | --- |
| Repository | `tuzhechen2005/DiffWitness` |
| Branch | `main` |
| Install command | `bash scripts/cloud-setup.sh` from the repository root |
| Startup services | None |
| Environment variables / secrets | None required |

In ChatGPT on the web or desktop, open **Settings > Codex Cloud > Environments >
Create environment**, select this repository, and let Codex prepare the
environment. Ask it to run the install command above. Review the setup results,
save changes, and select **Publish**. Wait for **Environment published** before
starting a development task.

Use **Work in > Cloud** and select the published DiffWitness environment to start
future tasks. Each task has its own workspace. Commit and push repository changes
to share them through GitHub; local uncommitted files are not automatically
transferred to cloud tasks.

Once the application stack is chosen, add its dependency manifest and lockfile,
update the setup command to install those dependencies, and document real build
and test commands in `AGENTS.md`. Edit and republish the cloud environment when
its reusable tools or setup changes.

Official guide: [Codex Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments).

## License

[Apache License 2.0](LICENSE).
