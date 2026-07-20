# shane-new-post

[English](./README.md) | **简体中文**

面向 AstroPaper 风格 Astro 博客的交互式「新建文章」命令行工具。安装本包后会在你的项目里生成一个 `scripts/new-post.js`，之后运行它即可脚手架新文章——支持交互模式，也支持一条命令直接生成。

一个包，两种语言：所有提示、注释和错误信息都可以是英文或简体中文，安装时选一次即可（也可以随时用参数覆盖）。

## 安装

推荐使用 `create` 初始化器，用法和 `npm create astro@latest` 一样：

```bash
# npm
npm create shane-new-post@latest

# pnpm
pnpm create shane-new-post@latest
```

这会把 `shane-new-post` 装进你的项目并自动跑完初始化——不需要额外的 `postinstall` 步骤。如果你的终端是交互式的、又没有提前传语言参数，它只会问你**一次**：

```
Select CLI language / 选择界面语言: (使用方向键)
❯ English
  简体中文
```

想跳过这个提问，提前加一个参数就行（`--lang=en` / `--lang=zh-cn`，或简写 `--en` / `--zh-cn`）：

```bash
# npm（注意中间那个额外的 --）
npm create shane-new-post@latest -- --lang=zh-cn

# pnpm
pnpm create shane-new-post@latest --lang=zh-cn
```

<details>
<summary>另一种方式：直接安装依赖包</summary>

```bash
# npm
npm install -D shane-new-post

# pnpm
pnpm add -D shane-new-post
pnpm approve-builds
```

> pnpm v9/v10 默认会拦截新依赖的安装脚本。执行 `pnpm approve-builds`，方向键选中 `shane-new-post`，按空格勾选，回车确认即可。想以后都不用手动批准，可以在项目的 `package.json` 里加：
> ```json
> "pnpm": { "onlyBuiltDependencies": ["shane-new-post"] }
> ```

</details>

装完之后 `pnpm new-post` 就可以直接用了。

## 完整文档

交互模式、命令模式、全部参数、语言设置，以及安装过程中具体做了什么（每一项检测、每一个可能被改动的文件）都写在文档站里：

📖 **https://shane-docs.pages.dev/zh-cn/cli/new-post/**（English: **https://shane-docs.pages.dev/en/cli/new-post/**）

## License

MIT
