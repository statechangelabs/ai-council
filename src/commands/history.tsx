import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { listHistory, getHistoryEntry } from "../core/history.js";
import type { HistoryEntry } from "../core/history.js";
import type { ConversationResult } from "../types.js";

interface Props {
  id?: string;
}

export function HistoryCommand({ id }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [detail, setDetail] = useState<ConversationResult | null>(null);

  useEffect(() => {
    async function run() {
      try {
        if (id) {
          const result = await getHistoryEntry(id);
          setDetail(result);
        } else {
          const list = await listHistory();
          setEntries(list);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [id]);

  if (loading) {
    return (
      <Box>
        <Text color="green"><Spinner type="dots" /></Text>
        <Text> Loading history...</Text>
      </Box>
    );
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (detail) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text bold>Topic: {detail.topic}</Text>
        <Text dimColor>
          {detail.counsellors.map(c => c.name).join(", ")} | {detail.rounds} round{detail.rounds > 1 ? "s" : ""} | {new Date(detail.startedAt).toLocaleString()}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {detail.turns.map((turn, i) => (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text bold color="cyan">
                [{turn.counsellorName}] Round {turn.round}
              </Text>
              <Text>{turn.content}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (entries.length === 0) {
    return <Text dimColor>No discussion history found.</Text>;
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold>Discussion History</Text>
      <Box flexDirection="column" marginTop={1}>
        {entries.map((entry) => (
          <Box key={entry.id} flexDirection="column" marginBottom={1}>
            <Text>
              <Text bold>{entry.topic.slice(0, 60)}</Text>
              {entry.topic.length > 60 ? "..." : ""}
            </Text>
            <Text dimColor>
              {new Date(entry.startedAt).toLocaleString()} | {entry.counsellors.join(", ")} | {entry.rounds} round{entry.rounds > 1 ? "s" : ""}
            </Text>
            <Text color="gray">ID: {entry.id}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
