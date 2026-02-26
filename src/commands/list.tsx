import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { loadCounsellors } from "../core/counsellor-loader.js";
import { getRegisteredPaths } from "../core/counsellor-registry.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Counsellor, CouncilConfig } from "../types.js";

interface Props {
  councilDir: string;
}

export function ListCommand({ councilDir }: Props) {
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let config: CouncilConfig = { backends: {} };
      try {
        config = JSON.parse(await readFile(join(homedir(), ".ai-council", "config.json"), "utf-8"));
      } catch { /* no config */ }
      const paths = getRegisteredPaths(config);
      return loadCounsellors(councilDir, paths);
    }
    load()
      .then((c) => {
        setCounsellors(c);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  if (loading) return <Text>Loading counsellors...</Text>;

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold>
        Available Counsellors ({counsellors.length}) from {councilDir}
      </Text>
      <Text> </Text>
      {counsellors.map((c) => (
        <Box key={c.id} flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold color="cyan">
              {c.frontmatter.name}
            </Text>{" "}
            <Text dimColor>({c.id})</Text>
          </Text>
          <Text>  {c.frontmatter.description}</Text>
          <Text dimColor>
            {"  "}Backend: {c.frontmatter.backend}
            {c.frontmatter.model ? ` (${c.frontmatter.model})` : ""} | Interests:{" "}
            {c.frontmatter.interests.join(", ")}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
