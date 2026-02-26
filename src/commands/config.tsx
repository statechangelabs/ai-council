import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { scanForKeys, maskKey, type FoundKey } from "../core/key-scanner.js";
import type { CouncilConfig } from "../types.js";

interface Props {
  subcommand: "scan" | "import" | "show";
  extraPaths?: string[];
  yes?: boolean;
}

async function loadConfig(): Promise<CouncilConfig> {
  const configPath = join(homedir(), ".ai-council", "config.json");
  try {
    return JSON.parse(await readFile(configPath, "utf-8"));
  } catch {
    return { backends: {} };
  }
}

async function saveConfig(config: CouncilConfig): Promise<void> {
  const dir = join(homedir(), ".ai-council");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.json"), JSON.stringify(config, null, 2), "utf-8");
}

function ShowConfig() {
  const [config, setConfig] = useState<CouncilConfig | null>(null);
  const [envKeys, setEnvKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfig().then(setConfig);
    setEnvKeys({
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    });
  }, []);

  if (!config) return <Text>Loading...</Text>;

  const configPath = join(homedir(), ".ai-council", "config.json");
  const backends = ["anthropic", "openai", "google", "ollama"];
  const envVars: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_API_KEY",
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold>Council Configuration</Text>
      <Text dimColor>{configPath}</Text>
      <Text> </Text>
      {backends.map((name) => {
        const bc = config.backends[name];
        const envVar = envVars[name];
        const hasEnv = envVar ? envKeys[envVar] : false;
        const hasConfig = !!bc?.apiKey;
        const ready = name === "ollama" || hasEnv || hasConfig;

        return (
          <Box key={name} flexDirection="column" marginBottom={1}>
            <Text>
              <Text color={ready ? "green" : "red"}>{ready ? "✓" : "✗"}</Text>
              {" "}
              <Text bold>{name}</Text>
            </Text>
            {name !== "ollama" && (
              <Text dimColor>
                {"  "}Config key: {hasConfig ? maskKey(bc!.apiKey!) : "(not set)"}
                {"  "}Env: {envVar} {hasEnv ? "(set)" : "(not set)"}
              </Text>
            )}
            {bc?.baseUrl && <Text dimColor>{"  "}Base URL: {bc.baseUrl}</Text>}
            {name === "ollama" && (
              <Text dimColor>{"  "}URL: {bc?.baseUrl || "http://localhost:11434 (default)"}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function ScanKeys({ extraPaths }: { extraPaths: string[] }) {
  const [keys, setKeys] = useState<FoundKey[] | null>(null);

  useEffect(() => {
    scanForKeys(extraPaths).then(setKeys);
  }, []);

  if (!keys) return <Text>Scanning for API keys...</Text>;

  if (keys.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="yellow">No API keys found.</Text>
        <Text dimColor>Searched .env files, shell profiles, and environment variables.</Text>
        <Text dimColor>You can specify additional paths: council config scan /path/to/project/.env</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold>Found {keys.length} API key{keys.length > 1 ? "s" : ""}:</Text>
      <Text> </Text>
      {keys.map((k, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text>
            <Text color="green">✓</Text>
            {" "}
            <Text bold>{k.backend}</Text>
            {" "}
            <Text dimColor>({k.envVar})</Text>
          </Text>
          <Text dimColor>{"  "}Value: {maskKey(k.value)}</Text>
          <Text dimColor>{"  "}Source: {k.source}</Text>
        </Box>
      ))}
      <Text> </Text>
      <Text dimColor>Run <Text color="cyan">council config import</Text> to save these to ~/.ai-council/config.json</Text>
    </Box>
  );
}

function ImportKeys({ extraPaths, autoConfirm }: { extraPaths: string[]; autoConfirm: boolean }) {
  const [status, setStatus] = useState<"scanning" | "importing" | "done" | "nothing">("scanning");
  const [keys, setKeys] = useState<FoundKey[]>([]);
  const [imported, setImported] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const found = await scanForKeys(extraPaths);
      setKeys(found);

      if (found.length === 0) {
        setStatus("nothing");
        return;
      }

      setStatus("importing");
      const config = await loadConfig();
      const added: string[] = [];

      for (const key of found) {
        if (!config.backends[key.backend]?.apiKey) {
          config.backends[key.backend] = {
            ...config.backends[key.backend],
            apiKey: key.value,
          };
          added.push(key.backend);
        }
      }

      if (added.length > 0) {
        await saveConfig(config);
      }

      setImported(added);
      setStatus("done");
    })();
  }, []);

  if (status === "scanning") return <Text>Scanning for API keys...</Text>;
  if (status === "nothing") return <Text color="yellow">No API keys found to import.</Text>;
  if (status === "importing") return <Text>Importing keys...</Text>;

  const configPath = join(homedir(), ".ai-council", "config.json");

  return (
    <Box flexDirection="column" paddingY={1}>
      {imported.length > 0 ? (
        <>
          <Text bold color="green">Imported {imported.length} key{imported.length > 1 ? "s" : ""}:</Text>
          {imported.map((backend) => {
            const key = keys.find((k) => k.backend === backend)!;
            return (
              <Text key={backend}>
                {"  "}<Text color="green">✓</Text> {backend} <Text dimColor>({maskKey(key.value)} from {key.source})</Text>
              </Text>
            );
          })}
          <Text> </Text>
          <Text dimColor>Saved to {configPath}</Text>
        </>
      ) : (
        <>
          <Text>All found keys are already configured:</Text>
          {keys.map((k) => (
            <Text key={k.backend} dimColor>
              {"  "}<Text color="green">✓</Text> {k.backend} — already set
            </Text>
          ))}
        </>
      )}
    </Box>
  );
}

export function ConfigCommand({ subcommand, extraPaths = [], yes = false }: Props) {
  switch (subcommand) {
    case "show":
      return <ShowConfig />;
    case "scan":
      return <ScanKeys extraPaths={extraPaths} />;
    case "import":
      return <ImportKeys extraPaths={extraPaths} autoConfirm={yes} />;
    default:
      return <Text color="red">Unknown subcommand: {subcommand}</Text>;
  }
}
