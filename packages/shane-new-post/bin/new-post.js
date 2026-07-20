#!/usr/bin/env node
import fs from "fs";
import path from "path";
import readline from "readline";
import { resolveLang, makeT, packageDirFromImportMeta } from "../lib/i18n.js";

// AUTHOR is written into the config file automatically from the author name
// you're asked for by postinstall when installing via npm/pnpm; leave it
// blank and the author field is simply never written
//
// lang is saved once at install time -- see lib/i18n.js for the full
// resolution order (a one-off --lang flag on this command always wins)
let CONFIG = {};

try {
  const configPath = path.join(process.cwd(), ".shane-new-post.json");
  if (fs.existsSync(configPath)) {
    CONFIG = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch {
  CONFIG = {};
}

const AUTHOR = CONFIG.author || "";

const POSTS_DIR = "src/content/posts";
const IMG_DIR = "public/img";

const PACKAGE_DIR = packageDirFromImportMeta(import.meta.url);
const { lang } = resolveLang({ config: CONFIG });
const t = makeT(PACKAGE_DIR, lang);

// Filename safety check: no path separators, no invalid characters, no ".." traversal
function checkFilename(filename) {
  const invalid = /[\\/:*?"<>|]/;

  if (invalid.test(filename) || filename.includes("..")) {
    throw new Error(t("errInvalidFilename"));
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

// Suggests a filename from the title: keep letters/digits/CJK, turn
// everything else into dashes, trim leading/trailing dashes
function suggestFilename(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Safely escapes a single-line YAML string by always wrapping it in quotes,
// so a title/description containing "colon + space", "#", or quote marks
// doesn't break the frontmatter parser
function yamlString(value) {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");

  return `"${escaped}"`;
}

// Scans existing posts' frontmatter and collects tags that have been used
// before, for reference hints in interactive mode
function scanExistingTaxonomy() {
  const tags = new Set();

  if (!fs.existsSync(POSTS_DIR)) {
    return { tags: [] };
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
    } catch {
      // A single unreadable/unparsable file shouldn't break the whole scan, just skip it
    }
  }

  return { tags: [...tags] };
}

function buildFrontmatter({ title, tags, description, featured, draft }) {
  const tagsBlock = tags.length
    ? `tags:\n${tags.map(t => `  - ${yamlString(t)}`).join("\n")}\n`
    : "";

  const authorLine = AUTHOR ? `author: ${yamlString(AUTHOR)}\n` : "";

  return `---
${authorLine}pubDatetime: ${nowISOWithOffset()}
title: ${yamlString(title)}
featured: ${featured}
draft: ${draft}
${tagsBlock}description: ${yamlString(description)}
---

# ${title}
`;
}

function createPost({
  title,
  filename,
  tags = [],
  description = "",
  featured = false,
  draft = false,
  useMdx = false,
}) {

  title = title?.trim();
  filename = filename?.trim();

  if (!title) {
    throw new Error(t("errTitleRequired"));
  }

  if (!filename) {
    throw new Error(t("errFilenameRequired"));
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
    throw new Error(t("errFileExists", { path: filePath }));
  }

  const content = buildFrontmatter({
    title,
    tags,
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

  console.log(t("createdHeader"));
  console.log(filePath);
  console.log(t("imgFolderLabel", { dir: imgDir }));
}


// =================
// Command mode (with arguments)
// =================

function parseSmartValue(value) {
  if (!value) return "";
  return value.trim();
}

function parseBooleanValue(value) {
  const v = String(value).trim().toLowerCase();
  return v === "true" || v === "t";
}

function commandMode(args) {
  const filename = args[0];

  if (!filename || filename.startsWith("-")) {
    console.log(t("usage"));
    process.exit(1);
  }

  let title = "";
  let description = "";
  let tags = [];
  let featured = false;
  let draft = false;
  let useMdx = false;

  // Supports:
  // title=xxx/description=xxx/mdx=true
  // title=xxx description=xxx mdx=true
  // Arguments can be in any order, spaces and / separators can be mixed
  //
  // Note: each arg must be split("/") individually and then flattened --
  // you can't join all args into one string first and split that, because
  // when arguments are space-separated (no / at all), the whole string would
  // be treated as a single token, with everything after the first "=" being
  // stuffed into the first key's value and every later argument lost.

  const optionLines = args
    .slice(1)
    .flatMap(arg => arg.split(/[/\\]/))
    .map(item => item.trim())
    .filter(Boolean);

  for (const arg of optionLines) {
    const index = arg.indexOf(":");

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
          .split(/[,，]/)
          .map(t => t.trim())
          .filter(Boolean);
        break;
      default:
        console.log(t("unknownParam", { key }));
        break;
    }
  }

  if (!title) {
    console.log(t("errTitleRequiredCli"));
    process.exit(1);
  }

  try {
    createPost({ title, filename, tags, description, featured, draft, useMdx });
  } catch (error) {
    console.log("❌ " + error.message);
    process.exit(1);
  }
}


// =================
// Interactive mode
// =================

async function interactiveMode() {

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = text =>
    new Promise(resolve => {
      rl.question(text, answer => resolve(answer.trim()));
    });

  console.log(t("interactiveTitle"));

  let title = "";
  while (!title) {
    title = await ask(t("askTitle"));
  }

  const suggested = suggestFilename(title);

  let filename = "";
  while (!filename) {
    const prompt = suggested
      ? t("askFilenameWithSuggestion", { suggested })
      : t("askFilenamePlain");
    const raw = await ask(prompt);
    filename = raw || suggested;

    if (!filename) continue;

    try {
      checkFilename(filename);
    } catch (error) {
      console.log("❌ " + error.message);
      filename = "";
    }
  }

  const { tags: existingTags } = scanExistingTaxonomy();

  if (existingTags.length) {
    console.log(t("previousTags", { tags: existingTags.join(", ") }));
  }

  const tagsInput = await ask(t("askTags"));

  const description = await ask(t("askDescription"));
  const featuredInput = await ask(t("askFeatured"));
  const draftInput = await ask(t("askDraft"));
  const mdxInput = await ask(t("askMdx"));

  rl.close();

  const tags = parseTags(tagsInput);
  const featured = /^y(es)?$/i.test(featuredInput);
  const draft = /^y(es)?$/i.test(draftInput);
  const useMdx = /^y(es)?$/i.test(mdxInput);

  try {
    createPost({ title, filename, tags, description, featured, draft, useMdx });
  } catch (error) {
    console.log("❌ " + error.message);
  }
}


// =================
// Entry point
// =================

// Strip out any --lang=xx / --en / --zh-cn flag first -- it's consumed by
// resolveLang() above via process.argv directly, and must not be mistaken
// for the filename positional in command mode.
const args = process.argv.slice(2).filter(arg =>
  !/^--lang=/i.test(arg) && !["--en", "--english", "--zh", "--zh-cn", "--chinese"].includes(arg)
);

if (args.length > 0) {
  commandMode(args);
} else {
  interactiveMode();
}
