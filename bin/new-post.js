#!/usr/bin/env node
import fs from "fs";
import path from "path";
import readline from "readline";

// 以下两行会在通过 npm/pnpm 安装本包时，由 postinstall 的交互式选择结果自动改写
// CATEGORY_ENABLED: true  = 建文章时会问分类，也会读取 --category 参数
//                   false = 完全没有分类功能（大多数 Astro 主题默认没有分类字段）
// AUTHOR: 装包时问过的作者名，留空就是完全不写 author 字段
let CONFIG = {};

try {
  const configPath = path.join(process.cwd(), ".shane-new-post.json");
  if (fs.existsSync(configPath)) {
    CONFIG = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch {
  CONFIG = {};
}

const CATEGORY_ENABLED = Boolean(CONFIG.category);
const AUTHOR = CONFIG.author || "";

const POSTS_DIR = "src/content/posts";
const IMG_DIR = "public/img";

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

// 标题转文件名建议：中文/字母数字保留，其余转短横线，掐头去尾多余的横线
function suggestFilename(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// YAML 单行字符串安全转义：统一加双引号包裹
// 避免标题/描述里包含「冒号+空格」「#」「引号」等字符时把 frontmatter 解析弄坏
function yamlString(value) {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");

  return `"${escaped}"`;
}

// 扫描已有文章的 frontmatter，收集出现过的标签/分类，供交互模式做参考提示
function scanExistingTaxonomy() {
  const tags = new Set();
  const categories = new Set();

  if (!fs.existsSync(POSTS_DIR)) {
    return { tags: [], categories: [] };
  }

  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".md") || f.endsWith(".mdx"));

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) continue;

      const fm = frontmatterMatch[1];

      const tagsMatch = fm.match(/tags:\n((?:\s+-\s+.+\n?)+)/);
      if (tagsMatch) {
        for (const line of tagsMatch[1].split("\n")) {
          const t = line.replace(/^\s*-\s*/, "").replace(/^"|"$/g, "").trim();
          if (t) tags.add(t);
        }
      }

      const categoryMatch = fm.match(/^category:\s*"?([^"\n]+)"?$/m);
      if (categoryMatch) categories.add(categoryMatch[1].trim());
    } catch {
      // 单个文件读取/解析失败不影响整体，跳过就好
    }
  }

  return { tags: [...tags], categories: [...categories] };
}

function buildFrontmatter({ title, tags, category, description, featured, draft }) {
  const tagsBlock = tags.length
    ? `tags:\n${tags.map(t => `  - ${yamlString(t)}`).join("\n")}\n`
    : "";

  const categoryLine = category ? `category: ${yamlString(category)}\n` : "";
  const authorLine = AUTHOR ? `author: ${yamlString(AUTHOR)}\n` : "";

  return `---
${authorLine}pubDatetime: ${nowISOWithOffset()}
title: ${yamlString(title)}
featured: ${featured}
draft: ${draft}
${tagsBlock}${categoryLine}description: ${yamlString(description)}
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
    category: CATEGORY_ENABLED ? category : "",
    description,
    featured,
    draft,
  });

  fs.writeFileSync(filePath, content, "utf8");

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

function parseSmartValue(value) {
  if (!value) return "";
  return value.trim();
}

function parseBooleanValue(value) {
  return String(value).toLowerCase() === "true";
}

function commandMode(args) {
  const filename = args[0];

  if (!filename || filename.startsWith("-")) {
    console.log(`
用法:

new-post "文件名" title=xxx Description=xxx mdx=true draft=false featured=true tags:[xxx,xxx]

示例:

new-post "astro-start" title=Astro入门 Description=介绍Astro mdx=true draft=false featured=false tags:[astro,web]

说明:
- 文件名必须作为第一个参数
- 后面的配置顺序可以随意
- 参数之间使用 / 分隔
- 也支持使用 \\ 换行输入
- tags 使用 [标签1,标签2]
`);
    process.exit(1);
  }

  let title = "";
  let description = "";
  let tags = [];
  let category = "";
  let featured = false;
  let draft = false;
  let useMdx = false;

  // 支持:
  // title=xxx/description=xxx/mdx=true
  // title=xxx\\
description=xxx\\
mdx=true
  // 参数顺序可以随意

  const optionText = args.slice(1).join(" ");
  const optionLines = optionText
    .replace(/\\\\\\n/g, "/")
    .split("/")
    .map(item => item.trim())
    .filter(Boolean);

  for (const arg of optionLines) {
    const index = arg.indexOf("=");

    if (index === -1) continue;

    const key = arg.slice(0, index).trim().toLowerCase();
    const value = arg.slice(index + 1).trim();

    switch (key) {
      case "title":
        title = parseSmartValue(value);
        break;
      case "description":
      case "desc":
        description = parseSmartValue(value);
        break;
      case "mdx":
        useMdx = parseBooleanValue(value);
        break;
      case "draft":
        draft = parseBooleanValue(value);
        break;
      case "featured":
        featured = parseBooleanValue(value);
        break;
      case "tags":
      case "tag":
        tags = value
          .replace(/^\[/, "")
          .replace(/\]$/, "")
          .split(",")
          .map(t => t.trim())
          .filter(Boolean);
        break;
      case "category":
        category = value
          .split(",")
          .map(t => t.trim())
          .filter(Boolean)
          .join(",");
        break;
      default:
        console.log(`ℹ️ 未知参数: ${key}，已忽略`);
        break;
    }
  }

  if (!title) {
    console.log("❌ title 必须填写");
    process.exit(1);
  }

  try {
    createPost({ title, filename, tags, category, description, featured, draft, useMdx });
  } catch (error) {
    console.log("❌ " + error.message);
    process.exit(1);
  }
}


// =================
// 问答模式
// =================

async function interactiveMode() {

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = text =>
    new Promise(resolve => {
      rl.question(text, answer => resolve(answer.trim()));
    });

  console.log("📝 新建博客文章\n");

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

  let title = "";
  while (!title) {
    title = await ask("标题: ");
  }

  const { tags: existingTags, categories: existingCategories } = scanExistingTaxonomy();

  if (existingTags.length) {
    console.log(`（已用过的标签: ${existingTags.join("、")}）`);
  }

  const tagsInput = await ask("标签(逗号分隔 空格跳过): ");

  let category = "";
  if (CATEGORY_ENABLED) {
    if (existingCategories.length) {
      console.log(`（已用过的分类: ${existingCategories.join("、")}）`);
    }
    category = await ask("分类(空格跳过): ");
  }

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
    createPost({ title, filename, tags, category, description, featured, draft, useMdx });
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
