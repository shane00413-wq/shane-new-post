#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";
import { select } from "@inquirer/prompts";

const configFile = path.join(os.homedir(), ".config", "shane-new-post", "config.json");

function addPackageCommand() {
  const pkg = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(pkg)) return;

  try {
    const data = JSON.parse(fs.readFileSync(pkg, "utf8"));
    data.scripts ??= {};

    if (!data.scripts["new-post"]) {
      data.scripts["new-post"] = "new-post";
      fs.writeFileSync(pkg, JSON.stringify(data, null, 2) + "\n");
      console.log("✅ 已添加 package.json scripts.new-post");
    }
  } catch {}
}

try {
  const answer = await select({
    message: "是否启用分类快捷创建",
    choices: [
      { name: "yes", value: true },
      { name: "no", value: false }
    ],
    default: false
  });

  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify({ category: answer }, null, 2));

  console.log(answer ? "✅ 已启用分类快捷创建" : "ℹ️ 已关闭分类快捷创建");
} catch {
  // 非交互安装跳过
}

addPackageCommand();
