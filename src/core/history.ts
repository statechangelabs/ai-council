import { readFile, writeFile, readdir, rm, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type { ConversationResult } from "../types.js";

export interface HistoryEntry {
  id: string;
  topic: string;
  title?: string;
  counsellors: string[];
  rounds: number;
  startedAt: string;
  completedAt: string;
}

const HISTORY_DIR = join(homedir(), ".ai-council", "history");

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export async function saveToHistory(result: ConversationResult): Promise<string> {
  await mkdir(HISTORY_DIR, { recursive: true });
  const timestamp = new Date(result.startedAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = slugify(result.topic);
  const id = `${timestamp}-${slug}`;
  const filePath = join(HISTORY_DIR, `${id}.json`);
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
  return id;
}

export async function listHistory(): Promise<HistoryEntry[]> {
  await mkdir(HISTORY_DIR, { recursive: true });
  const files = await readdir(HISTORY_DIR);
  const entries: HistoryEntry[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(HISTORY_DIR, file), "utf-8");
      const result: ConversationResult = JSON.parse(raw);
      entries.push({
        id: basename(file, ".json"),
        topic: result.topic,
        title: result.title,
        counsellors: result.counsellors.map(c => c.name),
        rounds: result.rounds,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
      });
    } catch { /* skip invalid files */ }
  }
  return entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getHistoryEntry(id: string): Promise<ConversationResult> {
  const filePath = join(HISTORY_DIR, `${id}.json`);
  const raw = await readFile(filePath, "utf-8");
  const result = JSON.parse(raw) as ConversationResult & { infographic?: string };
  // Migrate old singular infographic field to array
  if (result.infographic && !result.infographics) {
    result.infographics = [result.infographic];
    delete result.infographic;
  }
  return result;
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const filePath = join(HISTORY_DIR, `${id}.json`);
  await rm(filePath);
}

export async function addInfographicToHistory(id: string, infographic: string): Promise<void> {
  const filePath = join(HISTORY_DIR, `${id}.json`);
  const raw = await readFile(filePath, "utf-8");
  const result: ConversationResult = JSON.parse(raw);
  if (!result.infographics) result.infographics = [];
  result.infographics.push(infographic);
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
}

export async function deleteInfographicFromHistory(id: string, index: number): Promise<void> {
  const filePath = join(HISTORY_DIR, `${id}.json`);
  const raw = await readFile(filePath, "utf-8");
  const result: ConversationResult = JSON.parse(raw);
  if (result.infographics && index >= 0 && index < result.infographics.length) {
    result.infographics.splice(index, 1);
  }
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
}
