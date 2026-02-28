import type { ConversationEvent, ConversationResult, CouncilConfig } from "../types";

export interface HistoryEntry {
  id: string;
  topic: string;
  title?: string;
  counsellors: string[];
  rounds: number;
  startedAt: string;
  completedAt: string;
}

export interface CounsellorSummary {
  id: string;
  dirPath: string;
  name: string;
  description: string;
  backend: string;
  model?: string;
  temperature?: number;
  interests: string[];
  avatarUrl?: string;
  source?: "local" | "git";
  registryUrl?: string;
}

export interface CounsellorDetail {
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string;
}

export type DiscussionEvent =
  | ConversationEvent
  | { type: "complete"; result: ConversationResult }
  | { type: "summary_start" }
  | { type: "summary_chunk"; delta: string }
  | { type: "summary_complete"; summary: string; diagram?: unknown[] }
  | { type: "title_generated"; title: string }
  | { type: "round_summary_start"; round: number }
  | { type: "round_summary_chunk"; round: number; delta: string }
  | { type: "round_summary_complete"; round: number; summary: string }
  | { type: "infographic_start" }
  | { type: "infographic_complete"; infographic: string }
  | { type: "infographic_error"; error: string };

export interface CouncilAPI {
  getCouncilDir(): Promise<string>;
  listCounsellors(councilDir: string): Promise<CounsellorSummary[]>;
  getCounsellor(dirPath: string): Promise<CounsellorDetail>;
  saveCounsellor(dirPath: string, aboutMd: string): Promise<{ success: boolean }>;
  createCounsellor(councilDir: string, id: string, aboutMd: string): Promise<{ success: boolean; dirPath: string }>;
  deleteCounsellor(dirPath: string): Promise<{ success: boolean }>;
  getConfig(): Promise<{ config: CouncilConfig; envStatus: Record<string, boolean>; envKeySuffix: Record<string, string | undefined>; defaultUrls: Record<string, string> }>;
  saveConfig(config: CouncilConfig): Promise<{ success: boolean }>;
  probeBackend(name: string, config: { apiKey?: string; baseUrl?: string }): Promise<{ connected: boolean; models: string[]; error?: string }>;
  startDiscussion(params: {
    topic: string;
    topicSource: "inline" | "file";
    councilDir: string;
    counsellorIds?: string[];
    rounds: number;
    infographicBackends?: ("openai" | "google")[];
    mode?: "freeform" | "debate";
  }): Promise<void>;
  stopDiscussion(): Promise<{ success: boolean }>;
  injectMessage(content: string): Promise<{ success: boolean }>;
  onDiscussionEvent(callback: (event: DiscussionEvent) => void): () => void;
  selectDirectory(): Promise<string | null>;
  openInFinder(dirPath: string): Promise<void>;
  openInTerminal(dirPath: string): Promise<void>;
  openInEditor(dirPath: string): Promise<void>;
  listHistory(): Promise<HistoryEntry[]>;
  getHistoryEntry(id: string): Promise<ConversationResult>;
  deleteHistoryEntry(id: string): Promise<{ success: boolean }>;
  registryAddLocal(dirPath: string): Promise<{ id: string; name: string }>;
  registryAddRemote(url: string): Promise<{ id: string; name: string }[]>;
  registryRemove(id: string, deleteFiles?: boolean): Promise<{ success: boolean }>;
  readFileAsText(filePath: string): Promise<{ name: string; content: string }>;
  checkMarkitdown(): Promise<{ installed: boolean; version?: string }>;
  installMarkitdown(): Promise<{ success: boolean; error?: string }>;
  generateInfographic(historyId: string, backend?: "openai" | "google"): Promise<{ infographic: string }>;
  deleteInfographic(historyId: string, index: number): Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    councilAPI: CouncilAPI;
  }
}
