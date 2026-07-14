import fs from "fs";
import path from "path";
import readline from "readline";
import os from "os";


function initConfig() {
  const dir = path.join(process.cwd(), ".shane");
  const file = path.join(dir, "new-post.json");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file)) {
    console.log("Config already exists:", file);
    return;
  }
  fs.writeFileSync(file, JSON.stringify({
    postsDir: "src/content/posts",
    category: categoryEnabled(),
    author: "",
    template: "default"
  }, null, 2));
  console.log("Created:", file);
}

function showHelp(){
 console.log(`Usage: new-post [init]\n\nOptions: --title --filename --tags --category --description --featured --draft --mdx`);
}

if (process.argv.includes("--help")) { showHelp(); process.exit(0); }

if (process.argv[2] === "init") {
  initConfig();
  process.exit(0);
}

const POSTS_DIR = "src/content/posts";
const IMG_DIR = "public/img";
const CONFIG_FILE = path.join(os.homedir(), ".config", "shane-new-post", "config.json");

function categoryEnabled() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")).category === true;
  } catch {
    return false;
  }
}

// 文件名安全检查：不允许路径分隔符、非法字符、以及 ".." 越界
function checkFilename(filename) {

  const invalid = /[\\/:*?"<>|]/;

  if (invalid.test(filename) || filename.includes("..")) {
    throw new Error("文件名包含非法字符");
  }
}

function nowISOWithOffset() {
  return (
    new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" })
      .replace(" ", "T") + "+08:00"
  );
}

function parseTags(input) {
  return (input || "")
    .split(/[,，]/)
    .map(t => t.trim())
    .filter(Boolean);
}

function buildFrontmatter({ title, tags, category, description, featured, draft }) {

  // 没有标签就不写 tags 字段 让 schema 的 default(["others"]) 生效
  // 而不是留一个空 "- " 导致 YAML 解析出 null 元素
  const tagsBlock = tags.length
    ? `tags:\n${tags.map(t => `  - ${t}`).join("\n")}\n`
    : "";

  // 没有分类就整段不写 保持 optional 字段真正的 undefined
  const categoryLine = category ? `category: ${category}\n` : "";

  return `---
author: Shane
pubDatetime: ${nowISOWithOffset()}
title: ${title}
featured: ${featured}
draft: ${draft}
${tagsBlock}${categoryLine}description: ${description}
---

# ${title}
`;
}

function createPost({
  title,
  filename,
  tags = [],
  category = "",
  description = "",
  featured = false,
  draft = false,
  useMdx = false,
}) {

  title = title?.trim();
  filename = filename?.trim();

  if (!title) {
    throw new Error("标题不能为空");
  }

  if (!filename) {
    throw new Error("文件名不能为空");
  }

  checkFilename(filename);

  if (!filename.endsWith(".md") && !filename.endsWith(".mdx")) {
    filename += useMdx ? ".mdx" : ".md";
  }

  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  const filePath = path.join(POSTS_DIR, filename);

  if (fs.existsSync(filePath)) {
    throw new Error(`文件已经存在 为了不覆盖已有内容 已取消: ${filePath}`);
  }

  const content = buildFrontmatter({
    title,
    tags,
    category,
    description,
    featured,
    draft,
  });

  fs.writeFileSync(filePath, content, "utf8");

  // 顺手建好配图文件夹 和现有文章 public/img/<文件名> 的习惯保持一致
  const imgDirName = filename.replace(/\.mdx?$/, "");
  const imgDir = path.join(IMG_DIR, imgDirName);

  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
  }

  console.log("\n✅ 创建成功:");
  console.log(filePath);
  console.log(`📁 配图文件夹: ${imgDir}`);
}


// =================
// 命令模式（带参数）
// =================

function commandMode(args) {

  let title = "";
  let filename = "";
  let tags = [];
  let category = "";
  let description = "";
  let featured = false;
  let draft = false;
  let useMdx = false;

  for (let i = 0; i < args.length; i++) {

    switch (args[i]) {

      case "--title":
        title = args[++i] || "";
        break;

      case "--filename":
        filename = args[++i] || "";
        break;

      case "--tags":
        tags = parseTags(args[++i] || "");
        break;

      case "--category":
        category = args[++i] || "";
        break;

      case "--description":
        description = args[++i] || "";
        break;

      case "--featured":
        featured = true;
        break;

      case "--draft":
        draft = true;
        break;

      case "--mdx":
        useMdx = true;
        break;
    }
  }

  if (!title || !filename) {
    console.log(`
用法:

pnpm new-post --title "标题" --filename "文件名"

可选:

--tags "标签1,标签2"
--category "分类"
--description "描述"
--featured
--draft
--mdx
`);
    process.exit(1);
  }

  try {
    createPost({ title, filename, tags, category: categoryEnabled() ? category : "", description, featured, draft, useMdx });
  } catch (error) {
    console.log("❌ " + error.message);
    process.exit(1);
  }
}


// =================
// 问答模式
// =================

async function interactiveMode() {

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = text =>
    new Promise(resolve => {
      rl.question(text, answer => resolve(answer.trim()));
    });

  console.log("📝 新建博客文章\n");

  let title = "";
  while (!title) {
    title = await ask("标题: ");
  }

  let filename = "";
  while (!filename) {
    filename = await ask("文件名(不用加 .md): ");

    try {
      checkFilename(filename);
    } catch (error) {
      console.log("❌ " + error.message);
      filename = "";
    }
  }

  const tagsInput = await ask("标签(逗号分隔 空格跳过): ");
  const category = categoryEnabled() ? await ask("分类(空格跳过): ") : "";
  const description = await ask("描述(空格跳过): ");
  const featuredInput = await ask("是否精选 featured? (y/N): ");
  const draftInput = await ask("是否草稿 draft? (y/N): ");
  const mdxInput = await ask("是否启用 mdx? (y/N): ");

  rl.close();

  const tags = parseTags(tagsInput);
  const featured = /^y(es)?$/i.test(featuredInput);
  const draft = /^y(es)?$/i.test(draftInput);
  const useMdx = /^y(es)?$/i.test(mdxInput);

  try {
    createPost({ title, filename, tags, category: categoryEnabled() ? category : "", description, featured, draft, useMdx });
  } catch (error) {
    console.log("❌ " + error.message);
  }
}


// =================
// 启动
// =================

const args = process.argv.slice(2);

if (args.length > 0) {
  commandMode(args);
} else {
  interactiveMode();
}
