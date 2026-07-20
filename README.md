# shane-new-post (monorepo)

This repo publishes two npm packages, following the same layout as [withastro/astro](https://github.com/withastro/astro) (where `astro` and `create-astro` live in one repo):

- [`packages/shane-new-post`](./packages/shane-new-post) — the CLI itself. [npm](https://www.npmjs.com/package/shane-new-post)
- [`packages/create-shane-new-post`](./packages/create-shane-new-post) — its one-command initializer, invoked via `npm create shane-new-post@latest`. [npm](https://www.npmjs.com/package/create-shane-new-post)

Each package has its own README with install instructions. Full usage docs (interactive/command mode, all arguments, exactly what happens during install) are at:

📖 **https://shane-docs.pages.dev/en/cli/** · **https://shane-docs.pages.dev/zh-cn/cli/**

## Development

This is a pnpm workspace (`pnpm-workspace.yaml`); the root `package.json` is private and not published — only the packages under `packages/*` are.

```bash
pnpm install
```
