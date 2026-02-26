import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import { existsSync } from "node:fs";
import matter from "gray-matter";
import { CounsellorFrontmatterSchema, type Counsellor } from "../types.js";
import { resolveSkills } from "./skill-loader.js";

function resolveAvatar(avatar: string | undefined, dirPath: string): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) return avatar;
  const absPath = avatar.startsWith("/") ? avatar : join(dirPath, avatar);
  return `council-file://${absPath}`;
}

async function resolveReferences(content: string, counsellorDir: string): Promise<string> {
  const refPattern = /\{\{(.+?)\}\}/g;
  let resolved = content;

  for (const match of content.matchAll(refPattern)) {
    const refPath = match[1]!.trim();
    const fullPath = join(counsellorDir, refPath);
    if (existsSync(fullPath)) {
      const refContent = await readFile(fullPath, "utf-8");
      resolved = resolved.replace(match[0], refContent.trim());
    } else {
      resolved = resolved.replace(match[0], `[Reference not found: ${refPath}]`);
    }
  }

  return resolved;
}

export async function loadSingleCounsellor(dirPath: string): Promise<Counsellor> {
  const absPath = resolve(dirPath);
  const aboutPath = join(absPath, "ABOUT.md");
  if (!existsSync(aboutPath)) {
    throw new Error(`No ABOUT.md found in ${absPath}`);
  }

  const raw = await readFile(aboutPath, "utf-8");
  const { data, content } = matter(raw);

  const frontmatter = CounsellorFrontmatterSchema.parse(data);

  let systemPrompt = await resolveReferences(content.trim(), absPath);

  if (frontmatter.skills.length > 0) {
    const skillContent = await resolveSkills(frontmatter.skills, absPath);
    if (skillContent) {
      systemPrompt += "\n\n" + skillContent;
    }
  }

  return {
    id: basename(absPath),
    frontmatter,
    systemPrompt,
    dirPath: absPath,
    avatarUrl: resolveAvatar(frontmatter.avatar, absPath),
  };
}

export async function loadCounsellors(
  councilDir: string,
  registeredPaths?: string[],
): Promise<Counsellor[]> {
  const counsellors: Counsellor[] = [];
  const seenIds = new Set<string>();

  // Load registered counsellors first (they win on dedup)
  if (registeredPaths?.length) {
    for (const rPath of registeredPaths) {
      if (!existsSync(join(rPath, "ABOUT.md"))) continue;
      try {
        const c = await loadSingleCounsellor(rPath);
        if (!seenIds.has(c.id)) {
          counsellors.push(c);
          seenIds.add(c.id);
        }
      } catch {
        // skip invalid registered counsellors
      }
    }
  }

  // Then scan councilDir
  if (existsSync(councilDir)) {
    const entries = await readdir(councilDir);
    for (const entry of entries) {
      const entryPath = join(councilDir, entry);
      const info = await stat(entryPath);
      if (info.isDirectory() && existsSync(join(entryPath, "ABOUT.md"))) {
        if (!seenIds.has(basename(entryPath))) {
          counsellors.push(await loadSingleCounsellor(entryPath));
          seenIds.add(basename(entryPath));
        }
      }
    }
  }

  if (counsellors.length === 0) {
    throw new Error(`No counsellors found in ${councilDir}. Each counsellor needs a directory with an ABOUT.md file.`);
  }

  return counsellors;
}

export async function loadSpecificCounsellors(paths: string[]): Promise<Counsellor[]> {
  return Promise.all(paths.map(loadSingleCounsellor));
}
