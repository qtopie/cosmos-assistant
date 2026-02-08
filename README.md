# README

## About

This is the official Wails Vanilla template.

You can configure the project by editing `wails.json`. More information about the project settings can be found
here: https://wails.io/docs/reference/project-config

## Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development
server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser
and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect
to this in your browser, and you can call your Go code from devtools.

## Building

To build a redistributable, production mode package, use `wails build`.

## Release (GoReleaser)

Use GoReleaser to package linux/windows/macos builds:

```bash
goreleaser release --snapshot --clean
```

The artifacts are generated under `dist/`.

## GitHub Actions Release

This repo includes a workflow that builds release artifacts on tag push and uploads them to your server via SSH.

Required GitHub Secrets:

- `SSH_PRIVATE_KEY`: private key for the upload user
- `SSH_HOST`: server hostname or IP
- `SSH_PORT`: SSH port (e.g. `22`)
- `SSH_USER`: SSH username
- `SSH_PATH`: remote path for uploads (e.g. `/var/www/qtopie.space/downloads`)

Trigger a release by pushing a tag like `v1.2.3`:

```bash
git tag v1.2.3
git push origin v1.2.3
```
