import type { CounsellorSummary } from "../council-api";
import type { CouncilConfig } from "../../types";

const ENV_VAR_FOR_BACKEND: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_API_KEY",
};

export function getCounsellorIssues(
  counsellor: CounsellorSummary,
  config: CouncilConfig,
  envStatus: Record<string, boolean>,
): string[] {
  const issues: string[] = [];
  const backend = counsellor.backend;

  if (backend !== "ollama") {
    const envVar = ENV_VAR_FOR_BACKEND[backend];
    const hasEnv = envVar ? envStatus[envVar] : false;
    const hasConfigKey = !!config.backends[backend]?.apiKey;

    if (!hasEnv && !hasConfigKey) {
      issues.push(`No API key for ${backend} — set ${envVar} or configure in Settings`);
    }
  }

  return issues;
}
