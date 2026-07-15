# shane-new-post

为 AstroPaper 风格的 Astro 博客提供交互式新建文章工具。装包时会自动在你项目里生成 `scripts/new-post.js`，之后用 `pnpm new-post` 交互式建文章。

## 安装

**npm**
```bash
npm install -D shane-new-post
```

**pnpm**
```bash
pnpm add -D shane-new-post
pnpm approve-builds
```
> pnpm v9/v10 默认会拦截依赖包的安装脚本，跑一下 `pnpm approve-builds`，方向键选中 `shane-new-post`、空格勾选、回车确认即可。想一劳永逸不用每次手动批准，可以在项目 `package.json` 里加：
> ```json
> "pnpm": { "onlyBuiltDependencies": ["shane-new-post"] }
> ```

安装时会用方向键问一句「是否启用分类快捷创建」，默认 `no`（大多数 Astro 主题默认没有分类字段）。选择结果会直接写进生成的 `scripts/new-post.js` 里，之后重装依赖不会重复询问、也不会覆盖你对这个文件的手动修改。

## 使用

```bash
# 交互式
pnpm new-post

# 命令行传参
pnpm new-post --title "标题" --filename "文件名" --tags "a,b" --description "描述" --mdx
```

## 特性

- 只在项目里没有 `scripts/new-post.js`（或没有识别到本包管理标记）时才生成/接管，重装依赖不会覆盖你的手动修改
- 能识别 `new-post.js` / `new post.js` / `new-blog.js` / `new blog.js` 这几种命名的已有脚本，直接接管覆盖，不会重复建文件
- 标题和文件名分开填写
- 自动防止覆盖同名文章
- 支持 `.md` / `.mdx` 切换
- 自动建好对应的配图文件夹

## License

MIT
