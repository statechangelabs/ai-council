import { z } from "zod";

export const CounsellorFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  interests: z.array(z.string()).default([]),
  backend: z.enum(["anthropic", "openai", "google", "ollama"]),
  model: z.string().optional(),
  skills: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(2).optional(),
  avatar: z.string().optional(),
});

export type CounsellorFrontmatter = z.infer<typeof CounsellorFrontmatterSchema>;

export interface Counsellor {
  id: string;
  frontmatter: CounsellorFrontmatter;
  systemPrompt: string;
  dirPath: string;
  avatarUrl?: string;
}

export interface ConversationTurn {
  round: number;
  counsellorId: string;
  counsellorName: string;
  content: string;
  timestamp: string;
  model: string;
  backend: string;
  tokenUsage?: { input: number; output: number };
  avatarUrl?: string;
}

export interface ConversationResult {
  topic: string;
  topicSource: "inline" | "file";
  counsellors: Array<{
    id: string;
    name: string;
    description: string;
    backend: string;
    model: string;
    avatarUrl?: string;
  }>;
  rounds: number;
  turns: ConversationTurn[];
  startedAt: string;
  completedAt: string;
  totalTokenUsage: { input: number; output: number };
  summary?: string;
  diagram?: unknown[];
  title?: string;
  infographics?: string[];
  roundSummaries?: Record<number, string>;
  mode?: "freeform" | "debate";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  tokenUsage?: { input: number; output: number };
}

export interface ChatStreamChunk {
  delta: string;
  tokenUsage?: { input: number; output: number };
}

export interface BackendProvider {
  name: string;
  defaultModel: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream?(request: ChatRequest): AsyncIterable<ChatStreamChunk>;
}

export interface BackendConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface CounsellorRegistryEntry {
  path: string;            // absolute path to counsellor directory
  source: "local" | "git";
  url?: string;            // git origin, if cloned
  addedAt: string;         // ISO timestamp
}

export interface CouncilConfig {
  backends: Partial<Record<string, BackendConfig>>;
  counsellors?: Record<string, CounsellorRegistryEntry>;
  secretary?: {
    backend: string;
    model?: string;
    systemPrompt?: string;
  };
  infographic?: {
    backend: "openai" | "google";
  };
  defaults?: {
    counsellorIds?: string[];
    infographicBackends?: ("openai" | "google")[];
    mode?: "freeform" | "debate";
  };
}

export type ConversationEvent =
  | { type: "turn_start"; round: number; counsellorName: string }
  | { type: "turn_chunk"; counsellorName: string; delta: string }
  | { type: "turn_complete"; turn: ConversationTurn }
  | { type: "round_complete"; round: number }
  | { type: "error"; counsellorName: string; error: string }
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
