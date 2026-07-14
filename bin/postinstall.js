#!/usr/bin/env node

import fs from "fs";
import path from "path";
import os from "os";
import { select } from "@inquirer/prompts";

const currentPackage = path.join(process.cwd(), "package.json");

const configFile = path.join(
  os.homedir(),
  ".config",
  "shane-new-post",
  "config.json"
);

function readProjectPackage() {
  if (!fs.existsSync(currentPackage)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(currentPackage, "utf8"));
  } catch {
    return null;
  }
}

function isOwnRepository(pkg) {
  return pkg?.name === "shane-new-post";
}

function isAstroProject(pkg) {
  if (!pkg) return false;

  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {})
  };

  return Boolean(deps.astro);
}

function addPackageCommand(pkg) {
  if (!pkg) return;

  pkg.scripts ??= {};

  if (!pkg.scripts["new-post"]) {
    pkg.scripts["new-post"] = "new-post";

    fs.writeFileSync(
      currentPackage,
      JSON.stringify(pkg, null, 2) + "\n"
    );

    console.log("✅ 已添加 package.json scripts.new-post");
  }
}

async function setupCategory() {
  try {
    const answer = await select({
      message: "是否启用分类快捷创建",
      choices: [
        {
          name: "yes",
          value: true
        },
        {
          name: "no",
          value: false
        }
      ],
      default: false
    });

    fs.mkdirSync(path.dirname(configFile), {
      recursive: true
    });

    fs.writeFileSync(
      configFile,
      JSON.stringify(
        {
          category: answer
        },
        null,
        2
      )
    );

    console.log(
      answer
        ? "✅ 已启用分类快捷创建"
        : "ℹ️ 已关闭分类快捷创建"
    );
  } catch {
    console.log("ℹ️ 非交互安装，跳过分类设置");
  }
}

const projectPackage = readProjectPackage();

if (!projectPackage) {
  process.exit(0);
}

if (isOwnRepository(projectPackage)) {
  console.log("ℹ️ 检测到开发仓库，跳过 postinstall");
  process.exit(0);
}

if (!isAstroProject(projectPackage)) {
  console.log("ℹ️ 当前项目不是 Astro 项目，跳过 shane-new-post 初始化");
  process.exit(0);
}

addPackageCommand(projectPackage);

await setupCategory();