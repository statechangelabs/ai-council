import { readFile, writeFile, mkdir, rm, readdir, stat } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CouncilConfig, CounsellorRegistryEntry } from "../types.js";

const execFileAsync = promisify(execFile);

const CONFIG_PATH = join(homedir(), ".ai-council", "config.json");
const CLONES_DIR = join(homedir(), ".ai-council", "counsellors");

async function loadConfig(): Promise<CouncilConfig> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf-8"));
  } catch {
    return { backends: {} };
  }
}

async function saveConfig(config: CouncilConfig): Promise<void> {
  const dir = join(homedir(), ".ai-council");
  await mkdir(dir, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function getRegistry(config: CouncilConfig): Record<string, CounsellorRegistryEntry> {
  return config.counsellors ?? {};
}

export function getRegisteredPaths(config: CouncilConfig): string[] {
  return Object.values(config.counsellors ?? {}).map((e) => e.path);
}

export async function addLocalCounsellor(dirPath: string): Promise<{ id: string; name: string }> {
  const absPath = resolve(dirPath);
  const aboutPath = join(absPath, "ABOUT.md");

  if (!existsSync(aboutPath)) {
    throw new Error(`No ABOUT.md found in ${absPath}`);
  }

  const id = basename(absPath);
  const config = await loadConfig();
  const registry = config.counsellors ?? {};

  if (registry[id]) {
    throw new Error(`Counsellor "${id}" is already registered (path: ${registry[id].path})`);
  }

  // Read the name from frontmatter
  const raw = await readFile(aboutPath, "utf-8");
  const nameMatch = raw.match(/^name:\s*["']?(.+?)["']?\s*$/m);
  const displayName = nameMatch?.[1] ?? id;

  registry[id] = {
    path: absPath,
    source: "local",
    addedAt: new Date().toISOString(),
  };
  config.counsellors = registry;
  await saveConfig(config);

  return { id, name: displayName };
}

export async function addRemoteCounsellor(url: string): Promise<{ id: string; name: string }[]> {
  await mkdir(CLONES_DIR, { recursive: true });

  // Derive name from URL
  const repoName = basename(url, ".git").replace(/\.git$/, "");
  const clonePath = join(CLONES_DIR, repoName);

  if (existsSync(clonePath)) {
    throw new Error(`Directory already exists: ${clonePath}. Remove it first or use a different URL.`);
  }

  await execFileAsync("git", ["clone", "--depth", "1", url, clonePath]);

  const results: { id: string; name: string }[] = [];
  const config = await loadConfig();
  const registry = config.counsellors ?? {};

  // Check if root has ABOUT.md (single counsellor repo)
  if (existsSync(join(clonePath, "ABOUT.md"))) {
    const id = repoName;
    if (registry[id]) {
      throw new Error(`Counsellor "${id}" is already registered`);
    }

    const raw = await readFile(join(clonePath, "ABOUT.md"), "utf-8");
    const nameMatch = raw.match(/^name:\s*["']?(.+?)["']?\s*$/m);
    const displayName = nameMatch?.[1] ?? id;

    registry[id] = {
      path: clonePath,
      source: "git",
      url,
      addedAt: new Date().toISOString(),
    };
    results.push({ id, name: displayName });
  } else {
    // Multi-counsellor repo: scan child directories
    const entries = await readdir(clonePath);
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const entryPath = join(clonePath, entry);
      const info = await stat(entryPath);
      if (info.isDirectory() && existsSync(join(entryPath, "ABOUT.md"))) {
        const id = entry;
        if (registry[id]) continue; // skip duplicates

        const raw = await readFile(join(entryPath, "ABOUT.md"), "utf-8");
        const nameMatch = raw.match(/^name:\s*["']?(.+?)["']?\s*$/m);
        const displayName = nameMatch?.[1] ?? id;

        registry[id] = {
          path: entryPath,
          source: "git",
          url,
          addedAt: new Date().toISOString(),
        };
        results.push({ id, name: displayName });
      }
    }

    if (results.length === 0) {
      await rm(clonePath, { recursive: true, force: true });
      throw new Error(`No counsellors found in cloned repository (no ABOUT.md files)`);
    }
  }

  config.counsellors = registry;
  await saveConfig(config);

  return results;
}

export async function removeCounsellor(
  id: string,
  deleteFiles = false,
): Promise<void> {
  const config = await loadConfig();
  const registry = config.counsellors ?? {};
  const entry = registry[id];

  if (!entry) {
    throw new Error(`Counsellor "${id}" is not registered`);
  }

  // Only delete files for git-cloned counsellors when requested
  if (deleteFiles && entry.source === "git" && existsSync(entry.path)) {
    await rm(entry.path, { recursive: true, force: true });
  }

  delete registry[id];
  config.counsellors = registry;
  await saveConfig(config);
}
