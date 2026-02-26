import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const LOG_DIR = join(homedir(), ".ai-council");
const LOG_FILE = join(LOG_DIR, "council.log");

let ensured = false;

async function ensureDir() {
  if (ensured) return;
  await mkdir(LOG_DIR, { recursive: true });
  ensured = true;
}

function formatEntry(level: string, context: string, message: string, extra?: unknown): string {
  const ts = new Date().toISOString();
  let line = `[${ts}] ${level} [${context}] ${message}`;
  if (extra !== undefined) {
    const detail = extra instanceof Error
      ? `${extra.message}\n${extra.stack ?? ""}`
      : typeof extra === "string" ? extra : JSON.stringify(extra, null, 2);
    line += `\n  ${detail.replace(/\n/g, "\n  ")}`;
  }
  return line + "\n";
}

async function write(level: string, context: string, message: string, extra?: unknown) {
  try {
    await ensureDir();
    await appendFile(LOG_FILE, formatEntry(level, context, message, extra));
  } catch {
    // Last-resort: don't let logging itself crash the app
  }
}

export const log = {
  info: (context: string, message: string, extra?: unknown) => write("INFO", context, message, extra),
  warn: (context: string, message: string, extra?: unknown) => write("WARN", context, message, extra),
  error: (context: string, message: string, extra?: unknown) => write("ERROR", context, message, extra),
};
