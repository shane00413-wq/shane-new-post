// Shared language-resolution + message-loading helper.
//
// Resolution order (first match wins), same idea as most i18n-aware CLIs
// (eslint, npm, gh...) use for locale/config precedence:
//   1. Explicit flag on THIS invocation: --lang=en / --lang=zh-cn
//      (shorthands --en / --zh / --zh-cn / --chinese / --english also work)
//   2. SHANE_CLI_LANG environment variable (handy for CI, or for forwarding
//      a choice across a spawned child process/postinstall)
//   3. "lang" field already saved in the project's config file
//      (.shane-new-doc.json / .shane-new-post.json) -- set once at
//      install/init time, reused by every later run so it's never asked twice
//   4. The OS/shell locale (Intl / $LANG / $LC_ALL / $LANGUAGE)
//   5. Fallback: "en"
//
// Only step 5 is a silent guess with no signal at all; steps 1-4 all reflect
// something the user (or their environment) actually told us.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const SUPPORTED_LANGS = ["en", "zh-cn"];
const DEFAULT_LANG = "en";

function normalize(raw) {
  if (!raw) return null;
  const value = String(raw).toLowerCase().trim();
  if (["zh", "zh-cn", "zh_cn", "cn", "chinese", "zh-hans"].includes(value)) return "zh-cn";
  if (value.startsWith("zh")) return "zh-cn";
  if (["en", "english"].includes(value)) return "en";
  if (value.startsWith("en")) return "en";
  return null;
}

function fromArgv(argv) {
  for (const arg of argv) {
    if (arg === "--zh-cn" || arg === "--zh" || arg === "--chinese") return "zh-cn";
    if (arg === "--en" || arg === "--english") return "en";
    const match = arg.match(/^--lang=(.+)$/i);
    if (match) {
      const normalized = normalize(match[1]);
      if (normalized) return normalized;
    }
  }
  return null;
}

function fromEnv() {
  return normalize(process.env.SHANE_CLI_LANG);
}

function fromConfig(config) {
  return normalize(config?.lang);
}

function fromSystemLocale() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const normalized = normalize(locale);
    if (normalized) return normalized;
  } catch {
    // Intl not available/unexpected -- fall through to env vars below
  }
  const envLocale = process.env.LC_ALL || process.env.LANG || process.env.LANGUAGE || "";
  return normalize(envLocale);
}

// Returns the resolved language plus *why*, so callers can decide whether to
// still ask the user (only when the source was a low-confidence guess).
export function resolveLang({ argv = process.argv.slice(2), config = null } = {}) {
  const fromFlag = fromArgv(argv);
  if (fromFlag) return { lang: fromFlag, source: "flag" };

  const fromEnvVar = fromEnv();
  if (fromEnvVar) return { lang: fromEnvVar, source: "env" };

  const fromSavedConfig = fromConfig(config);
  if (fromSavedConfig) return { lang: fromSavedConfig, source: "config" };

  const guessed = fromSystemLocale();
  if (guessed) return { lang: guessed, source: "locale-guess" };

  return { lang: DEFAULT_LANG, source: "default" };
}

const messageCache = {};

export function loadMessages(packageDir, lang) {
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
  const cacheKey = packageDir + ":" + safeLang;
  if (messageCache[cacheKey]) return messageCache[cacheKey];

  const file = path.join(packageDir, "i18n", `${safeLang}.json`);
  const messages = JSON.parse(fs.readFileSync(file, "utf8"));
  messageCache[cacheKey] = messages;
  return messages;
}

export function makeT(packageDir, lang) {
  const messages = loadMessages(packageDir, lang);
  return function t(key, vars) {
    let str = messages[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.split(`{${k}}`).join(v);
      }
    }
    return str;
  };
}

// Helper for locating "this package's own directory" from within bin/*.js
// (i.e. the parent of bin/), so callers don't each re-derive it.
export function packageDirFromImportMeta(importMetaUrl) {
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..");
}

// Prompts the user to pick a language, ONLY called when we don't already
// have a confident answer (flag/env/config). Always shown bilingually --
// at this point we don't know the answer yet, so we can't translate the
// question itself. Falls back silently to the locale guess when not a TTY.
export async function askLangIfNeeded({ argv = process.argv.slice(2), config = null } = {}) {
  const resolved = resolveLang({ argv, config });

  if (resolved.source !== "locale-guess") {
    // We already have a confident source (explicit flag / env / saved config) -- don't ask.
    return resolved.lang;
  }

  if (!process.stdin.isTTY) {
    return resolved.lang;
  }

  try {
    const { select } = await import("@inquirer/prompts");
    const choice = await select({
      message: "Select CLI language / 选择界面语言:",
      choices: [
        { name: "English", value: "en" },
        { name: "简体中文", value: "zh-cn" },
      ],
      default: resolved.lang,
    });
    return choice;
  } catch {
    // ExitPromptError or prompt unavailable -- keep the locale guess rather than failing
    return resolved.lang;
  }
}
