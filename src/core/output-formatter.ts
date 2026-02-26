import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationResult } from "../types.js";

function toMarkdown(result: ConversationResult): string {
  const lines: string[] = [];
  const date = new Date(result.startedAt).toISOString().split("T")[0];

  lines.push(`# Council Discussion: ${result.topic.slice(0, 100)}`);
  lines.push("");
  lines.push(`**Counsellors:** ${result.counsellors.map((c) => c.name).join(", ")}`);
  lines.push(`**Rounds:** ${result.rounds} | **Date:** ${date}`);
  lines.push("");

  let currentRound = 0;
  for (const turn of result.turns) {
    if (turn.round !== currentRound) {
      currentRound = turn.round;
      lines.push("---");
      lines.push("");
      lines.push(`## Round ${currentRound}`);
      lines.push("");
    }

    lines.push(`### ${turn.counsellorName}`);
    lines.push(`*${turn.backend}/${turn.model}*`);
    lines.push("");
    lines.push(turn.content);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    `*Total tokens — input: ${result.totalTokenUsage.input}, output: ${result.totalTokenUsage.output}*`,
  );

  return lines.join("\n");
}

export async function writeOutput(
  result: ConversationResult,
  outputDir: string,
  format: "md" | "json" | "both",
): Promise<string[]> {
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const written: string[] = [];

  if (format === "md" || format === "both") {
    const mdPath = join(outputDir, `council-${timestamp}.md`);
    await writeFile(mdPath, toMarkdown(result), "utf-8");
    written.push(mdPath);
  }

  if (format === "json" || format === "both") {
    const jsonPath = join(outputDir, `council-${timestamp}.json`);
    await writeFile(jsonPath, JSON.stringify(result, null, 2), "utf-8");
    written.push(jsonPath);
  }

  return written;
}
