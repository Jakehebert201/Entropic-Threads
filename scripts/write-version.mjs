import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function sh(cmd) {
  return execSync(cmd).toString().trim();
}

function readGit(cmd, fallback = "") {
  try {
    return sh(cmd);
  } catch {
    return fallback;
  }
}

const commit = readGit("git rev-parse --short HEAD", "unknown");
const tag = readGit("git describe --tags --abbrev=0", "v0.0.0");
const branch = readGit("git rev-parse --abbrev-ref HEAD", "unknown");
let dirty = false;
try {
  dirty = sh("git status --porcelain").length > 0;
} catch {
  dirty = false;
}

const buildTime = new Date().toISOString();
const env = process.env.BUILD_ENV || "development";

const payload = {
  name: "Entropic-Threads",
  version: tag,
  commit,
  branch,
  dirty,
  buildTime,
  env,
};

mkdirSync("public", { recursive: true });
const outPath = join("public", "version.json");
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log("Wrote public/version.json:", payload);
