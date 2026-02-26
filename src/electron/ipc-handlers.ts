import { dialog, shell, type BrowserWindow, type IpcMain } from "electron";
import { readFile, writeFile, mkdir, rm, readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import matter from "gray-matter";
import { loadCounsellors } from "../core/counsellor-loader.js";
import {
  getRegisteredPaths,
  addLocalCounsellor,
  addRemoteCounsellor,
  removeCounsellor,
} from "../core/counsellor-registry.js";
import { runConversation, type RunConversationOptions } from "../core/conversation-engine.js";
import { clearCaches } from "../backends/index.js";
import { saveToHistory, listHistory, getHistoryEntry, deleteHistoryEntry, addInfographicToHistory, deleteInfographicFromHistory } from "../core/history.js";
import { runSecretary, generateTitle } from "../core/secretary.js";
import { generateInfographic, hasImageBackend } from "../core/infographic.js";
import { log } from "../core/logger.js";
import type { ConversationTurn, ConversationResult, CouncilConfig, BackendConfig, ConversationEvent } from "../types.js";

// Load dotenv for API keys
import "dotenv/config";

// Default base URLs for each backend
const DEFAULT_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com",
  ollama: "http://localhost:11434",
};

// Well-known models for backends that don't have a list endpoint
const KNOWN_ANTHROPIC_MODELS = [
  "claude-opus-4-20250514",
  "claude-sonnet-4-5-20250514",
  "claude-sonnet-4-20250514",
  "claude-haiku-4-20250414",
  "claude-3-5-haiku-20241022",
];

const KNOWN_GOOGLE_MODELS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

interface ProbeResult {
  connected: boolean;
  models: string[];
  error?: string;
}

async function probeBackend(name: string, config: BackendConfig): Promise<ProbeResult> {
  try {
    switch (name) {
      case "ollama": {
        const { Ollama } = await import("ollama");
        const client = new Ollama({ host: config.baseUrl || DEFAULT_URLS.ollama });
        const response = await client.list();
        const models = response.models.map((m: { name: string }) => m.name).sort();
        return { connected: true, models };
      }
      case "openai": {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({
          apiKey: config.apiKey || process.env.OPENAI_API_KEY,
          ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
        });
        const response = await client.models.list();
        const models = response.data
          .map((m) => m.id)
          .filter((id) => id.startsWith("gpt-") || id.startsWith("o") || id.startsWith("chatgpt-"))
          .sort();
        return { connected: true, models };
      }
      case "anthropic": {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({
          apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
          ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
        });
        // Anthropic has a models list endpoint
        try {
          const response = await client.models.list({ limit: 100 });
          const models = response.data.map((m) => m.id).sort();
          return { connected: true, models };
        } catch {
          // Fall back to known models if list endpoint fails (e.g. older API)
          return { connected: true, models: KNOWN_ANTHROPIC_MODELS };
        }
      }
      case "google": {
        const apiKey = config.apiKey || process.env.GOOGLE_API_KEY || "";
        if (!apiKey) return { connected: false, models: KNOWN_GOOGLE_MODELS, error: "No API key" };
        // Use REST API to list models — the SDK doesn't expose listModels
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
          return { connected: false, models: KNOWN_GOOGLE_MODELS, error: msg };
        }
        const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
        const models = (data.models || [])
          .filter((m) => m.name.includes("gemini") && m.supportedGenerationMethods?.includes("generateContent"))
          .map((m) => m.name.replace("models/", ""))
          .sort();
        return { connected: true, models: models.length > 0 ? models : KNOWN_GOOGLE_MODELS };
      }
      default:
        return { connected: false, models: [], error: `Unknown backend: ${name}` };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // Return known models even on connection failure so the UI can still show options
    const fallbackModels = name === "anthropic" ? KNOWN_ANTHROPIC_MODELS
      : name === "google" ? KNOWN_GOOGLE_MODELS
      : [];
    return { connected: false, models: fallbackModels, error };
  }
}

let activeAbortController: AbortController | null = null;
let injectionBuffer: string[] = [];

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null,
) {
  // --- Counsellor CRUD ---

  ipcMain.handle("counsellors:list", async (_event, councilDir: string) => {
    const configPath = join(homedir(), ".ai-council", "config.json");
    let config: CouncilConfig = { backends: {} };
    try {
      const raw = await readFile(configPath, "utf-8");
      config = JSON.parse(raw);
    } catch { /* no config */ }
    const registeredPaths = getRegisteredPaths(config);
    const registry = config.counsellors ?? {};
    const counsellors = await loadCounsellors(councilDir, registeredPaths);
    return counsellors.map((c) => {
      const regEntry = registry[c.id];
      return {
        id: c.id,
        dirPath: c.dirPath,
        name: c.frontmatter.name,
        description: c.frontmatter.description,
        backend: c.frontmatter.backend,
        model: c.frontmatter.model,
        temperature: c.frontmatter.temperature,
        interests: c.frontmatter.interests,
        avatarUrl: c.avatarUrl,
        source: regEntry?.source,
        registryUrl: regEntry?.url,
      };
    });
  });

  ipcMain.handle("counsellors:get", async (_event, dirPath: string) => {
    const aboutPath = join(dirPath, "ABOUT.md");
    const raw = await readFile(aboutPath, "utf-8");
    const { data, content } = matter(raw);
    return { frontmatter: data, body: content.trim(), raw };
  });

  ipcMain.handle("counsellors:save", async (_event, dirPath: string, aboutMd: string) => {
    const aboutPath = join(dirPath, "ABOUT.md");
    await writeFile(aboutPath, aboutMd, "utf-8");
    return { success: true };
  });

  ipcMain.handle("counsellors:create", async (_event, councilDir: string, id: string, aboutMd: string) => {
    const dirPath = join(councilDir, id);
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, "ABOUT.md"), aboutMd, "utf-8");
    return { success: true, dirPath };
  });

  ipcMain.handle("counsellors:delete", async (_event, dirPath: string) => {
    await rm(dirPath, { recursive: true, force: true });
    return { success: true };
  });

  // --- Config ---

  ipcMain.handle("config:get", async () => {
    const configPath = join(homedir(), ".ai-council", "config.json");
    let config: CouncilConfig = { backends: {} };
    try {
      const raw = await readFile(configPath, "utf-8");
      config = JSON.parse(raw);
    } catch {
      // No config file yet
    }

    const envStatus: Record<string, boolean> = {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    };

    const suffix = (key?: string) => key ? "..." + key.slice(-4) : undefined;
    const envKeySuffix: Record<string, string | undefined> = {
      ANTHROPIC_API_KEY: suffix(process.env.ANTHROPIC_API_KEY),
      OPENAI_API_KEY: suffix(process.env.OPENAI_API_KEY),
      GOOGLE_API_KEY: suffix(process.env.GOOGLE_API_KEY),
    };

    return { config, envStatus, envKeySuffix, defaultUrls: DEFAULT_URLS };
  });

  ipcMain.handle("backend:probe", async (_event, name: string, config: BackendConfig) => {
    return probeBackend(name, config);
  });

  ipcMain.handle("config:save", async (_event, config: CouncilConfig) => {
    const configDir = join(homedir(), ".ai-council");
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "config.json"), JSON.stringify(config, null, 2), "utf-8");
    clearCaches();
    return { success: true };
  });

  // --- Discussion ---

  ipcMain.handle("discussion:start", async (_event, params: {
    topic: string;
    topicSource: "inline" | "file";
    councilDir: string;
    counsellorIds?: string[];
    rounds: number;
    infographicBackends?: ("openai" | "google")[];
    mode?: "freeform" | "debate";
  }) => {
    const win = getWindow();
    if (!win) return { error: "No window" };

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    injectionBuffer = [];

    const configPath = join(homedir(), ".ai-council", "config.json");
    let config: CouncilConfig = { backends: {} };
    try {
      const raw = await readFile(configPath, "utf-8");
      config = JSON.parse(raw);
    } catch { /* no config */ }
    const registeredPaths = getRegisteredPaths(config);
    const allCounsellors = await loadCounsellors(params.councilDir, registeredPaths);
    const counsellors = params.counsellorIds?.length
      ? allCounsellors.filter((c) => params.counsellorIds!.includes(c.id))
      : allCounsellors;

    if (counsellors.length === 0) {
      win.webContents.send("discussion:event", { type: "error", counsellorName: "", error: "No counsellors found" });
      return;
    }

    const send = (event: ConversationEvent | { type: "complete"; result: unknown }) => {
      if (!win.isDestroyed()) {
        win.webContents.send("discussion:event", event);
      }
    };

    const beforeTurn = async (): Promise<ConversationTurn | null> => {
      if (injectionBuffer.length === 0) return null;
      const content = injectionBuffer.shift()!;
      return {
        round: 0,
        counsellorId: "__user__",
        counsellorName: "You",
        content,
        timestamp: new Date().toISOString(),
        model: "human",
        backend: "human",
      };
    };

    const opts: RunConversationOptions = {
      topic: params.topic,
      topicSource: params.topicSource,
      counsellors,
      rounds: params.rounds,
      onEvent: send,
      beforeTurn,
      signal: activeAbortController.signal,
      mode: params.mode,
      config,
    };

    try {
      const result = await runConversation(opts);

      // Run secretary if configured
      if (config.secretary?.backend) {
        try {
          send({ type: "summary_start" } as any);
          const secretaryResult = await runSecretary({
            result,
            config,
            onChunk: (delta) => {
              send({ type: "summary_chunk", delta } as any);
            },
            signal: activeAbortController?.signal,
          });
          (result as ConversationResult).summary = secretaryResult.text;
          if (secretaryResult.diagram) {
            (result as ConversationResult).diagram = secretaryResult.diagram;
          }
          send({ type: "summary_complete", summary: secretaryResult.text, diagram: secretaryResult.diagram } as any);
        } catch (err) {
          log.error("ipc:discussion", "Secretary summary failed", err);
          send({ type: "error", counsellorName: "Secretary", error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Generate title if secretary is configured
      if (config.secretary?.backend) {
        try {
          const firstRoundTurns = result.turns.filter((t) => t.round === 1);
          const title = await generateTitle({
            topic: result.topic,
            firstRoundTurns,
            config,
          });
          (result as ConversationResult).title = title;
          send({ type: "title_generated", title } as any);
        } catch (err) {
          log.error("ipc:discussion", "Title generation failed", err);
        }
      }

      // Generate infographics if requested
      if (params.infographicBackends?.length) {
        for (const backend of params.infographicBackends) {
          try {
            send({ type: "infographic_start" } as any);
            const infographicData = await generateInfographic(result, config, backend);
            if (!(result as ConversationResult).infographics) (result as ConversationResult).infographics = [];
            (result as ConversationResult).infographics!.push(infographicData);
            send({ type: "infographic_complete", infographic: infographicData } as any);
          } catch (err) {
            log.error("ipc:discussion", `Infographic generation failed (${backend})`, err);
            send({ type: "infographic_error", error: err instanceof Error ? err.message : String(err) } as any);
          }
        }
      }

      send({ type: "complete", result });
      try { await saveToHistory(result); } catch (err) {
        log.error("ipc:discussion", "Failed to save to history", err);
      }
    } catch (err) {
      log.error("ipc:discussion", "Discussion failed", err);
      send({ type: "error", counsellorName: "", error: err instanceof Error ? err.message : String(err) });
    } finally {
      activeAbortController = null;
    }
  });

  ipcMain.handle("discussion:stop", async () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    return { success: true };
  });

  ipcMain.handle("discussion:inject", async (_event, content: string) => {
    injectionBuffer.push(content);
    return { success: true };
  });

  // --- Counsellor Registry ---

  ipcMain.handle("registry:add-local", async (_event, dirPath: string) => {
    return addLocalCounsellor(dirPath);
  });

  ipcMain.handle("registry:add-remote", async (_event, url: string) => {
    return addRemoteCounsellor(url);
  });

  ipcMain.handle("registry:remove", async (_event, id: string, deleteFiles?: boolean) => {
    await removeCounsellor(id, deleteFiles);
    return { success: true };
  });

  // --- Open-with ---

  ipcMain.handle("shell:open-in-finder", async (_event, dirPath: string) => {
    shell.showItemInFolder(join(dirPath, "ABOUT.md"));
  });

  ipcMain.handle("shell:open-in-terminal", async (_event, dirPath: string) => {
    const execFileAsync = promisify(execFile);
    // macOS: open Terminal.app at the directory
    await execFileAsync("open", ["-a", "Terminal", dirPath]);
  });

  ipcMain.handle("shell:open-in-editor", async (_event, dirPath: string) => {
    const execFileAsync = promisify(execFile);
    // Try VS Code first, fall back to system open
    try {
      await execFileAsync("code", [dirPath]);
    } catch {
      shell.openPath(dirPath);
    }
  });

  // --- History ---

  ipcMain.handle("history:list", async () => listHistory());

  ipcMain.handle("history:get", async (_event, id: string) => getHistoryEntry(id));

  ipcMain.handle("history:delete", async (_event, id: string) => {
    await deleteHistoryEntry(id);
    return { success: true };
  });

  ipcMain.handle("infographic:generate", async (_event, historyId: string, backend?: "openai" | "google") => {
    const configPath = join(homedir(), ".ai-council", "config.json");
    let config: CouncilConfig = { backends: {} };
    try {
      const raw = await readFile(configPath, "utf-8");
      config = JSON.parse(raw);
    } catch { /* no config */ }

    const result = await getHistoryEntry(historyId);
    const infographicData = await generateInfographic(result, config, backend);
    await addInfographicToHistory(historyId, infographicData);
    return { infographic: infographicData };
  });

  ipcMain.handle("infographic:delete", async (_event, historyId: string, index: number) => {
    await deleteInfographicFromHistory(historyId, index);
    return { success: true };
  });

  // --- File reading for attachments ---

  ipcMain.handle("file:read-as-text", async (_event, filePath: string) => {
    const name = basename(filePath);
    const ext = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";

    const textExtensions = new Set([
      ".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".xml", ".html", ".htm",
      ".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".rs", ".java", ".c",
      ".cpp", ".h", ".hpp", ".css", ".scss", ".less", ".sql", ".sh", ".bash",
      ".zsh", ".env", ".toml", ".ini", ".cfg", ".conf", ".log", ".svg",
    ]);

    // Formats that markitdown can convert to text/markdown
    const markitdownExtensions = new Set([
      ".pdf", ".docx", ".pptx", ".xlsx", ".xls", ".doc", ".ppt",
      ".epub", ".rtf",
    ]);

    // Plain text files — read directly
    if (textExtensions.has(ext)) {
      try {
        const content = await readFile(filePath, "utf-8");
        return { name, content };
      } catch (err) {
        return { name, content: `[Error reading file: ${err instanceof Error ? err.message : String(err)}]` };
      }
    }

    // Rich document files — convert via markitdown
    if (markitdownExtensions.has(ext)) {
      const execFileAsync = promisify(execFile);
      try {
        const { stdout } = await execFileAsync("markitdown", [filePath], {
          timeout: 30_000,
          maxBuffer: 10 * 1024 * 1024, // 10 MB
        });
        return { name, content: stdout };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) {
          return {
            name,
            content: `[Cannot convert ${ext} file: markitdown is not installed. Run: pip install 'markitdown[all]']`,
          };
        }
        return { name, content: `[Error converting file: ${msg}]` };
      }
    }

    return { name, content: `[Unsupported file type: ${name}]` };
  });

  // --- Markitdown tool ---

  ipcMain.handle("markitdown:check", async () => {
    const execFileAsync = promisify(execFile);
    try {
      const { stdout } = await execFileAsync("markitdown", ["--version"], { timeout: 5_000 });
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false };
    }
  });

  ipcMain.handle("markitdown:install", async () => {
    const execFileAsync = promisify(execFile);
    try {
      await execFileAsync("pip", ["install", "markitdown[all]"], {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // --- Dialog ---

  ipcMain.handle("dialog:selectDirectory", async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
