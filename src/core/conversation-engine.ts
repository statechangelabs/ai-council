import type {
  Counsellor,
  ConversationTurn,
  ConversationResult,
  ConversationEvent,
  ChatMessage,
  CouncilConfig,
} from "../types.js";
import { getBackend } from "../backends/index.js";
import { runInterimSummary } from "./secretary.js";
import { log } from "./logger.js";

function buildMessages(
  topic: string,
  turns: ConversationTurn[],
  currentCounsellorId: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "user", content: topic }];

  for (const turn of turns) {
    if (turn.counsellorId === currentCounsellorId) {
      messages.push({ role: "assistant", content: turn.content });
    } else {
      messages.push({
        role: "user",
        content: `[${turn.counsellorName}, Round ${turn.round}]: ${turn.content}`,
      });
    }
  }

  return messages;
}

function buildDebateMessages(
  topic: string,
  turns: ConversationTurn[],
  currentCounsellorId: string,
  currentRound: number,
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "user", content: topic }];

  if (currentRound === 1) {
    // Constructive: only the topic, no other turns visible
    return messages;
  }

  // Rebuttal: show all round 1 (constructive) turns
  const constructiveTurns = turns.filter((t) => t.round === 1);
  for (const turn of constructiveTurns) {
    if (turn.counsellorId === currentCounsellorId) {
      messages.push({ role: "assistant", content: turn.content });
    } else {
      messages.push({
        role: "user",
        content: `[${turn.counsellorName}, Constructive]: ${turn.content}`,
      });
    }
  }

  // Show only the previous rebuttal round (N-1)
  const prevRound = currentRound - 1;
  if (prevRound > 1) {
    const prevTurns = turns.filter((t) => t.round === prevRound);
    for (const turn of prevTurns) {
      if (turn.counsellorId === currentCounsellorId) {
        messages.push({ role: "assistant", content: turn.content });
      } else {
        messages.push({
          role: "user",
          content: `[${turn.counsellorName}, Round ${prevRound}]: ${turn.content}`,
        });
      }
    }
  }

  // Include current counsellor's own prior turns from other rebuttal rounds (not round 1, not prevRound)
  for (const turn of turns) {
    if (
      turn.counsellorId === currentCounsellorId &&
      turn.round !== 1 &&
      turn.round !== prevRound &&
      turn.round < currentRound
    ) {
      messages.push({ role: "assistant", content: turn.content });
    }
  }

  return messages;
}

function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array];
  // Simple seeded PRNG (mulberry32)
  let s = seed | 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildResult(
  opts: RunConversationOptions,
  turns: ConversationTurn[],
  startedAt: string,
  totalInput: number,
  totalOutput: number,
  roundSummaries?: Record<number, string>,
): ConversationResult {
  return {
    topic: opts.topic,
    topicSource: opts.topicSource,
    counsellors: opts.counsellors.map((c) => ({
      id: c.id,
      name: c.frontmatter.name,
      description: c.frontmatter.description,
      backend: c.frontmatter.backend,
      model: c.frontmatter.model ?? "default",
      avatarUrl: c.avatarUrl,
    })),
    rounds: opts.rounds,
    turns,
    startedAt,
    completedAt: new Date().toISOString(),
    totalTokenUsage: { input: totalInput, output: totalOutput },
    ...(roundSummaries && Object.keys(roundSummaries).length > 0 ? { roundSummaries } : {}),
    ...(opts.mode === "debate" ? { mode: "debate" as const } : {}),
  };
}

export interface RunConversationOptions {
  topic: string;
  topicSource: "inline" | "file";
  counsellors: Counsellor[];
  rounds: number;
  onEvent: (event: ConversationEvent) => void;
  beforeTurn?: () => Promise<ConversationTurn | null>;
  signal?: AbortSignal;
  mode?: "freeform" | "debate";
  config?: CouncilConfig;
}

export async function runConversation(
  topicOrOpts: string | RunConversationOptions,
  topicSource?: "inline" | "file",
  counsellors?: Counsellor[],
  rounds?: number,
  onEvent?: (event: ConversationEvent) => void,
): Promise<ConversationResult> {
  let opts: RunConversationOptions;
  if (typeof topicOrOpts === "string") {
    opts = {
      topic: topicOrOpts,
      topicSource: topicSource!,
      counsellors: counsellors!,
      rounds: rounds!,
      onEvent: onEvent!,
    };
  } else {
    opts = topicOrOpts;
  }

  const startedAt = new Date().toISOString();
  const turns: ConversationTurn[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  const isDebate = opts.mode === "debate";
  const roundSummaries: Record<number, string> = {};

  log.info("conversation", `Starting ${isDebate ? "debate" : "freeform"} — ${opts.counsellors.length} counsellors, ${opts.rounds} rounds`, {
    counsellors: opts.counsellors.map((c) => `${c.frontmatter.name} (${c.frontmatter.backend}/${c.frontmatter.model ?? "default"})`),
    topic: opts.topic.slice(0, 200),
  });

  for (let round = 1; round <= opts.rounds; round++) {
    // In debate mode: round 1 keeps original order, rounds 2+ shuffle
    const roundCounsellors = isDebate && round > 1
      ? shuffleWithSeed(opts.counsellors, round)
      : opts.counsellors;

    for (const counsellor of roundCounsellors) {
      if (opts.signal?.aborted) {
        return buildResult(opts, turns, startedAt, totalInput, totalOutput, roundSummaries);
      }

      if (opts.beforeTurn) {
        const injected = await opts.beforeTurn();
        if (injected) {
          turns.push(injected);
          opts.onEvent({ type: "turn_complete", turn: injected });
        }
      }

      opts.onEvent({ type: "turn_start", round, counsellorName: counsellor.frontmatter.name });

      try {
        const backend = await getBackend(counsellor.frontmatter.backend);
        const model = counsellor.frontmatter.model ?? backend.defaultModel;
        const messages = isDebate
          ? buildDebateMessages(opts.topic, turns, counsellor.id, round)
          : buildMessages(opts.topic, turns, counsellor.id);
        const chatRequest = {
          model,
          systemPrompt: counsellor.systemPrompt,
          messages,
          temperature: counsellor.frontmatter.temperature,
        };

        let content: string;
        let tokenUsage: { input: number; output: number } | undefined;

        if (backend.chatStream) {
          content = "";
          for await (const chunk of backend.chatStream(chatRequest)) {
            if (opts.signal?.aborted) break;
            content += chunk.delta;
            if (chunk.delta) {
              opts.onEvent({ type: "turn_chunk", counsellorName: counsellor.frontmatter.name, delta: chunk.delta });
            }
            if (chunk.tokenUsage) {
              tokenUsage = chunk.tokenUsage;
            }
          }
        } else {
          const response = await backend.chat(chatRequest);
          content = response.content;
          tokenUsage = response.tokenUsage;
        }

        const turn: ConversationTurn = {
          round,
          counsellorId: counsellor.id,
          counsellorName: counsellor.frontmatter.name,
          content,
          timestamp: new Date().toISOString(),
          model,
          backend: counsellor.frontmatter.backend,
          tokenUsage,
          avatarUrl: counsellor.avatarUrl,
        };

        if (tokenUsage) {
          totalInput += tokenUsage.input;
          totalOutput += tokenUsage.output;
        }

        turns.push(turn);
        opts.onEvent({ type: "turn_complete", turn });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error("conversation", `Turn failed for ${counsellor.frontmatter.name} (round ${round}, model ${counsellor.frontmatter.model ?? "default"}, backend ${counsellor.frontmatter.backend})`, err);
        opts.onEvent({ type: "error", counsellorName: counsellor.frontmatter.name, error: message });
      }
    }

    opts.onEvent({ type: "round_complete", round });

    // Interim secretary summary after each round (debate mode only)
    if (isDebate && opts.config?.secretary?.backend && !opts.signal?.aborted) {
      try {
        const interimResult = buildResult(opts, turns, startedAt, totalInput, totalOutput, roundSummaries);
        opts.onEvent({ type: "round_summary_start", round });
        const summary = await runInterimSummary({
          result: interimResult,
          roundNumber: round,
          config: opts.config,
          onChunk: (delta) => {
            opts.onEvent({ type: "round_summary_chunk", round, delta });
          },
          signal: opts.signal,
        });
        roundSummaries[round] = summary;
        opts.onEvent({ type: "round_summary_complete", round, summary });
      } catch (err) {
        log.error("conversation", `Interim summary failed for round ${round}`, err);
      }
    }
  }

  return buildResult(opts, turns, startedAt, totalInput, totalOutput, roundSummaries);
}
