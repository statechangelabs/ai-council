import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { BackendProvider, BackendConfig, CouncilConfig } from "../types.js";
import { createAnthropicBackend } from "./anthropic.js";
import { createOpenAIBackend } from "./openai.js";
import { createGoogleBackend } from "./google.js";
import { createOllamaBackend } from "./ollama.js";

type BackendFactory = (config: BackendConfig) => BackendProvider;

const factories: Record<string, BackendFactory> = {
  anthropic: createAnthropicBackend,
  openai: createOpenAIBackend,
  google: createGoogleBackend,
  ollama: createOllamaBackend,
};

let configCache: CouncilConfig | null = null;

async function loadConfig(): Promise<CouncilConfig> {
  if (configCache) return configCache;

  const configPath = join(homedir(), ".ai-council", "config.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    configCache = JSON.parse(raw) as CouncilConfig;
  } catch {
    configCache = { backends: {} };
  }
  return configCache;
}

const backendCache = new Map<string, BackendProvider>();

export function clearCaches() {
  configCache = null;
  backendCache.clear();
}

export async function getBackend(name: string): Promise<BackendProvider> {
  const cached = backendCache.get(name);
  if (cached) return cached;

  const factory = factories[name];
  if (!factory) {
    throw new Error(`Unknown backend: "${name}". Available: ${Object.keys(factories).join(", ")}`);
  }

  const config = await loadConfig();
  const backendConfig = config.backends[name] ?? {};
  const backend = factory(backendConfig);
  backendCache.set(name, backend);
  return backend;
}
