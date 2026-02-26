import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface FoundKey {
  backend: string;
  envVar: string;
  value: string;
  source: string;
}

const KEY_PATTERNS: { backend: string; envVar: string; pattern: RegExp }[] = [
  { backend: "anthropic", envVar: "ANTHROPIC_API_KEY", pattern: /ANTHROPIC_API_KEY\s*=\s*['"]?([^\s'"#]+)/ },
  { backend: "openai", envVar: "OPENAI_API_KEY", pattern: /OPENAI_API_KEY\s*=\s*['"]?([^\s'"#]+)/ },
  { backend: "google", envVar: "GOOGLE_API_KEY", pattern: /GOOGLE_API_KEY\s*=\s*['"]?([^\s'"#]+)/ },
  // Also pick up GEMINI_API_KEY and GOOGLE_GEMINI_API_KEY as google
  { backend: "google", envVar: "GEMINI_API_KEY", pattern: /(?<![A-Z_])GEMINI_API_KEY\s*=\s*['"]?([^\s'"#]+)/ },
  { backend: "google", envVar: "GOOGLE_GEMINI_API_KEY", pattern: /GOOGLE_GEMINI_API_KEY\s*=\s*['"]?([^\s'"#]+)/ },
];

function getSearchPaths(): string[] {
  const home = homedir();
  return [
    // Current project
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    // Home directory dotfiles
    join(home, ".env"),
    join(home, ".bashrc"),
    join(home, ".bash_profile"),
    join(home, ".zshrc"),
    join(home, ".zshenv"),
    join(home, ".zprofile"),
    join(home, ".profile"),
    // Common project locations
    join(home, ".config", "shell", "env"),
    // Fish shell
    join(home, ".config", "fish", "config.fish"),
  ];
}

async function scanFile(filePath: string): Promise<FoundKey[]> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return [];
  }

  const found: FoundKey[] = [];
  for (const { backend, envVar, pattern } of KEY_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].length > 5) {
      found.push({ backend, envVar, value: match[1], source: filePath });
    }
  }
  return found;
}

export async function scanForKeys(extraPaths: string[] = []): Promise<FoundKey[]> {
  const paths = [...getSearchPaths(), ...extraPaths];
  const results: FoundKey[] = [];

  // Also check current process env
  for (const { backend, envVar } of KEY_PATTERNS) {
    const val = process.env[envVar];
    if (val && val.length > 5) {
      results.push({ backend, envVar, value: val, source: "process.env" });
    }
  }

  for (const filePath of paths) {
    const found = await scanFile(filePath);
    results.push(...found);
  }

  // Deduplicate — prefer the first occurrence per backend
  const seen = new Map<string, FoundKey>();
  for (const key of results) {
    if (!seen.has(key.backend)) {
      seen.set(key.backend, key);
    }
  }

  return Array.from(seen.values());
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
