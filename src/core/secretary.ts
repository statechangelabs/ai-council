import type { ConversationResult, ConversationTurn, CouncilConfig } from "../types.js";
import { getBackend } from "../backends/index.js";
import { getExcalidrawCheatsheet } from "./excalidraw-cheatsheet.js";

export interface SecretaryResult {
  text: string;
  diagram?: unknown[];
}

const EXCALIDRAW_DELIMITER = "---EXCALIDRAW---";

const DEFAULT_SYSTEM_PROMPT = `You are the Secretary of a council discussion. Your job is to synthesize a clear, structured summary of the conversation that just took place.

Structure your summary with these sections:

## Individual Positions
Briefly summarize each counsellor's key arguments and stance.

## Points of Convergence
Where did the counsellors agree? What common ground emerged?

## Points of Divergence
Where did they disagree? What are the key tensions?

## Synthesis
What are the most important takeaways? What would you recommend based on the full discussion?

Be concise but thorough. Use markdown formatting.`;

function buildTranscript(result: ConversationResult): string {
  const lines: string[] = [];
  lines.push(`Topic: ${result.topic}`);
  lines.push(`Counsellors: ${result.counsellors.map(c => c.name).join(", ")}`);
  lines.push(`Rounds: ${result.rounds}`);
  lines.push("");

  let currentRound = 0;
  for (const turn of result.turns) {
    if (turn.round !== currentRound) {
      currentRound = turn.round;
      lines.push(`--- Round ${currentRound} ---`);
      lines.push("");
    }
    lines.push(`[${turn.counsellorName}]:`);
    lines.push(turn.content);
    lines.push("");
  }

  return lines.join("\n");
}

export async function runSecretary({
  result,
  config,
  onChunk,
  signal,
}: {
  result: ConversationResult;
  config: CouncilConfig;
  onChunk?: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<SecretaryResult> {
  const secretaryConfig = config.secretary;
  if (!secretaryConfig?.backend) {
    throw new Error("No secretary backend configured");
  }

  const backend = await getBackend(secretaryConfig.backend);
  const model = secretaryConfig.model ?? backend.defaultModel;

  const basePrompt = secretaryConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const cheatsheet = getExcalidrawCheatsheet();
  const systemPrompt = `${basePrompt}

${cheatsheet}

After your text summary, output \`${EXCALIDRAW_DELIMITER}\` on its own line, then a JSON array of Excalidraw elements showing a visual map of where each counsellor stands on the topic. Use shapes for each counsellor with their name, arrows to show relationships (agreement/disagreement), and position them to visually represent the discussion dynamics.`;

  const transcript = buildTranscript(result);

  const chatRequest = {
    model,
    systemPrompt,
    messages: [{ role: "user" as const, content: `Please summarize this council discussion and create a position diagram:\n\n${transcript}` }],
    temperature: 0.5,
  };

  let fullResponse = "";

  if (backend.chatStream) {
    for await (const chunk of backend.chatStream(chatRequest)) {
      if (signal?.aborted) break;
      fullResponse += chunk.delta;
      if (chunk.delta && onChunk) {
        onChunk(chunk.delta);
      }
    }
  } else {
    const response = await backend.chat(chatRequest);
    fullResponse = response.content;
    if (onChunk) onChunk(fullResponse);
  }

  // Parse response: split on delimiter
  const delimiterIndex = fullResponse.indexOf(EXCALIDRAW_DELIMITER);
  if (delimiterIndex === -1) {
    return { text: fullResponse.trim() };
  }

  const text = fullResponse.slice(0, delimiterIndex).trim();
  const diagramRaw = fullResponse.slice(delimiterIndex + EXCALIDRAW_DELIMITER.length).trim();

  // Try to extract JSON array from the diagram portion
  let diagram: unknown[] | undefined;
  try {
    // Find the JSON array in the response (it might be wrapped in markdown code blocks)
    const jsonMatch = diagramRaw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      diagram = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Non-fatal: diagram parsing failed, just return the text
  }

  return { text, diagram };
}

const INTERIM_SYSTEM_PROMPT = `You are the Secretary of a council debate. Briefly summarize this round of discussion. Note emerging agreements, disagreements, and shifts in position. 2-3 paragraphs max. Use markdown formatting.`;

export async function runInterimSummary({
  result,
  roundNumber,
  config,
  onChunk,
  signal,
}: {
  result: ConversationResult;
  roundNumber: number;
  config: CouncilConfig;
  onChunk?: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const secretaryConfig = config.secretary;
  if (!secretaryConfig?.backend) {
    throw new Error("No secretary backend configured");
  }

  const backend = await getBackend(secretaryConfig.backend);
  const model = secretaryConfig.model ?? backend.defaultModel;

  // Build transcript of only this round's turns
  const roundTurns = result.turns.filter((t) => t.round === roundNumber);
  const lines: string[] = [];
  lines.push(`Topic: ${result.topic}`);
  lines.push(`Round ${roundNumber}${roundNumber === 1 ? " (Constructive)" : " (Rebuttal)"}`);
  lines.push("");
  for (const turn of roundTurns) {
    lines.push(`[${turn.counsellorName}]:`);
    lines.push(turn.content);
    lines.push("");
  }

  const chatRequest = {
    model,
    systemPrompt: INTERIM_SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: `Please summarize this round:\n\n${lines.join("\n")}` }],
    temperature: 0.5,
  };

  let fullResponse = "";

  if (backend.chatStream) {
    for await (const chunk of backend.chatStream(chatRequest)) {
      if (signal?.aborted) break;
      fullResponse += chunk.delta;
      if (chunk.delta && onChunk) {
        onChunk(chunk.delta);
      }
    }
  } else {
    const response = await backend.chat(chatRequest);
    fullResponse = response.content;
    if (onChunk) onChunk(fullResponse);
  }

  return fullResponse.trim();
}

export async function generateTitle({
  topic,
  firstRoundTurns,
  config,
}: {
  topic: string;
  firstRoundTurns: ConversationTurn[];
  config: CouncilConfig;
}): Promise<string> {
  const secretaryConfig = config.secretary;
  if (!secretaryConfig?.backend) {
    throw new Error("No secretary backend configured");
  }

  const backend = await getBackend(secretaryConfig.backend);
  const model = secretaryConfig.model ?? backend.defaultModel;

  const turnsSummary = firstRoundTurns
    .map((t) => `[${t.counsellorName}]: ${t.content.slice(0, 300)}`)
    .join("\n\n");

  const response = await backend.chat({
    model,
    systemPrompt:
      "Generate a concise title (max 8 words) for this council discussion. Return only the title, no quotes or punctuation at the end.",
    messages: [
      {
        role: "user",
        content: `Topic: ${topic}\n\nFirst round:\n${turnsSummary}`,
      },
    ],
    temperature: 0.3,
  });

  // Strip quotes and trailing punctuation
  return response.content
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/[.!?]+$/, "")
    .trim();
}
