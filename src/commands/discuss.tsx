import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadCounsellors, loadSpecificCounsellors } from "../core/counsellor-loader.js";
import { getRegisteredPaths } from "../core/counsellor-registry.js";
import { runConversation } from "../core/conversation-engine.js";
import { writeOutput } from "../core/output-formatter.js";
import { saveToHistory } from "../core/history.js";
import { runSecretary } from "../core/secretary.js";
import { generateInfographic } from "../core/infographic.js";
import { log } from "../core/logger.js";
import type { ConversationEvent, ConversationTurn, CouncilConfig } from "../types.js";

interface Props {
  topic: string;
  councilDir: string;
  counsellorPaths?: string[];
  rounds: number;
  outputDir: string;
  format: "md" | "json" | "both";
  infographic?: boolean;
  mode?: "freeform" | "debate";
}

export function DiscussCommand({
  topic,
  councilDir,
  counsellorPaths,
  rounds,
  outputDir,
  format,
  infographic: generateInfographicFlag,
  mode = "freeform",
}: Props) {
  const [status, setStatus] = useState("Loading counsellors...");
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [completedTurns, setCompletedTurns] = useState<ConversationTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [outputFiles, setOutputFiles] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "running" | "complete">("idle");
  const [summaryText, setSummaryText] = useState("");
  const [infographicSaved, setInfographicSaved] = useState(false);
  const [roundSummaries, setRoundSummaries] = useState<Record<number, string>>({});
  const [activeRoundSummary, setActiveRoundSummary] = useState<string>("");

  useEffect(() => {
    async function run() {
      try {
        // Resolve topic
        let resolvedTopic = topic;
        let topicSource: "inline" | "file" = "inline";
        if (existsSync(topic)) {
          resolvedTopic = await readFile(topic, "utf-8");
          topicSource = "file";
        }

        // Load config and counsellors
        let cfg: CouncilConfig = { backends: {} };
        let registeredPaths: string[] = [];
        try {
          cfg = JSON.parse(
            await readFile(join(homedir(), ".ai-council", "config.json"), "utf-8"),
          );
          registeredPaths = getRegisteredPaths(cfg);
        } catch { /* no config */ }

        const counsellors = counsellorPaths?.length
          ? await loadSpecificCounsellors(counsellorPaths)
          : await loadCounsellors(councilDir, registeredPaths);

        setStatus(
          `Starting ${mode === "debate" ? "debate" : "discussion"} with ${counsellors.length} counsellor${counsellors.length > 1 ? "s" : ""} over ${rounds} round${rounds > 1 ? "s" : ""}`,
        );

        const onEvent = (event: ConversationEvent) => {
          switch (event.type) {
            case "turn_start":
              setCurrentRound(event.round);
              setCurrentSpeaker(event.counsellorName);
              setStatus(`Round ${event.round} — ${event.counsellorName} is speaking...`);
              break;
            case "turn_complete":
              setCompletedTurns((prev) => [...prev, event.turn]);
              setCurrentSpeaker(null);
              break;
            case "round_complete":
              setStatus(`Round ${event.round} complete`);
              break;
            case "round_summary_start":
              setActiveRoundSummary("");
              setStatus(`Summarizing round ${event.round}...`);
              break;
            case "round_summary_chunk":
              setActiveRoundSummary((prev) => prev + event.delta);
              break;
            case "round_summary_complete":
              setRoundSummaries((prev) => ({ ...prev, [event.round]: event.summary }));
              setActiveRoundSummary("");
              break;
            case "error":
              setError(`Error from ${event.counsellorName}: ${event.error}`);
              break;
          }
        };

        const result = await runConversation({
          topic: resolvedTopic,
          topicSource,
          counsellors,
          rounds,
          onEvent,
          mode,
          config: cfg,
        });

        setStatus("Writing output...");
        const files = await writeOutput(result, outputDir, format);
        setOutputFiles(files);

        // Run secretary if configured
        if (cfg.secretary?.backend) {
          try {
            setSummaryStatus("running");
            setStatus("Secretary is summarizing...");
            const secretaryResult = await runSecretary({
              result,
              config: cfg,
              onChunk: (delta) => {
                setSummaryText((prev) => prev + delta);
              },
            });
            result.summary = secretaryResult.text;
            if (secretaryResult.diagram) {
              result.diagram = secretaryResult.diagram;
            }
            setSummaryStatus("complete");
            setSummaryText(secretaryResult.text);
          } catch (err) {
            log.error("cli:discuss", "Secretary summary failed", err);
          }
        }

        // Generate infographic if requested
        if (generateInfographicFlag) {
          try {
            setStatus("Generating infographic...");
            const infographicData = await generateInfographic(result, cfg, undefined);
            if (!result.infographics) result.infographics = [];
            result.infographics.push(infographicData);
            setInfographicSaved(true);
          } catch (err) {
            log.error("cli:discuss", "Infographic generation failed", err);
          }
        }

        try { await saveToHistory(result); } catch (err) {
          log.error("cli:discuss", "Failed to save to history", err);
        }
        setDone(true);
      } catch (err) {
        log.error("cli:discuss", "Discussion failed", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    run();
  }, []);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (done) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="green">Discussion complete!</Text>
        <Text>
          {completedTurns.length} turns across {currentRound} round
          {currentRound > 1 ? "s" : ""}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Output files:</Text>
          {outputFiles.map((f) => (
            <Text key={f} color="cyan">
              {"  "}{f}
            </Text>
          ))}
        </Box>
        {Object.keys(roundSummaries).length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {Object.entries(roundSummaries).map(([round, summary]) => (
              <Box key={round} flexDirection="column" marginBottom={1}>
                <Text bold color="yellow">Round {round} Summary:</Text>
                <Text>{summary}</Text>
              </Box>
            ))}
          </Box>
        )}
        {summaryStatus === "complete" && summaryText && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="blue">Secretary's Summary:</Text>
            <Text>{summaryText}</Text>
          </Box>
        )}
        {infographicSaved && (
          <Box marginTop={1}>
            <Text color="magenta">Infographic saved to history.</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        <Text> {status}</Text>
      </Box>
      {completedTurns.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {completedTurns.slice(-3).map((turn, i) => (
            <Text key={i} dimColor>
              Round {turn.round} — {turn.counsellorName}: {turn.content.slice(0, 80)}...
            </Text>
          ))}
        </Box>
      )}
      {activeRoundSummary && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow" dimColor>{activeRoundSummary.slice(0, 120)}...</Text>
        </Box>
      )}
    </Box>
  );
}
