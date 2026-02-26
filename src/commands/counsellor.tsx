import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import {
  getRegistry,
  addLocalCounsellor,
  addRemoteCounsellor,
  removeCounsellor,
} from "../core/counsellor-registry.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import type { CouncilConfig, CounsellorRegistryEntry } from "../types.js";

interface Props {
  subcommand: "add" | "remove" | "list";
  target?: string;
  yes?: boolean;
}

function isUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://") || s.endsWith(".git");
}

export function CounsellorCommand({ subcommand, target, yes }: Props) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");
  const [registry, setRegistry] = useState<Record<string, CounsellorRegistryEntry>>({});

  useEffect(() => {
    async function run() {
      try {
        switch (subcommand) {
          case "add": {
            if (!target) {
              setMessage("Error: Please provide a path or URL.\n  $ council counsellor add <path-or-url>");
              setStatus("error");
              process.exitCode = 1;
              return;
            }

            if (isUrl(target)) {
              setMessage(`Cloning ${target}...`);
              const results = await addRemoteCounsellor(target);
              const lines = results.map((r) => `  ${r.id} — ${r.name}`).join("\n");
              setMessage(`Registered ${results.length} counsellor${results.length > 1 ? "s" : ""} from git:\n${lines}`);
            } else {
              const result = await addLocalCounsellor(target);
              setMessage(`Registered: ${result.id} — ${result.name}`);
            }
            setStatus("done");
            break;
          }

          case "remove": {
            if (!target) {
              setMessage("Error: Please provide a counsellor id.\n  $ council counsellor remove <id>");
              setStatus("error");
              process.exitCode = 1;
              return;
            }
            await removeCounsellor(target, yes);
            setMessage(`Removed: ${target}`);
            setStatus("done");
            break;
          }

          case "list": {
            const configPath = join(homedir(), ".ai-council", "config.json");
            let config: CouncilConfig = { backends: {} };
            try {
              config = JSON.parse(await readFile(configPath, "utf-8"));
            } catch {
              // no config
            }
            const reg = getRegistry(config);
            setRegistry(reg);
            setStatus("done");
            break;
          }
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
        setStatus("error");
        process.exitCode = 1;
      }
    }
    run();
  }, []);

  if (status === "loading" && subcommand === "add") {
    return (
      <Box>
        <Text color="green"><Spinner type="dots" /></Text>
        <Text> {message || "Processing..."}</Text>
      </Box>
    );
  }

  if (status === "error") {
    return <Text color="red">Error: {message}</Text>;
  }

  if (subcommand === "list") {
    const entries = Object.entries(registry);
    if (entries.length === 0) {
      return <Text dimColor>No registered counsellors. Use `council counsellor add` to register one.</Text>;
    }
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text bold>Registered Counsellors ({entries.length})</Text>
        <Text> </Text>
        {entries.map(([id, entry]) => {
          const onDisk = existsSync(join(entry.path, "ABOUT.md"));
          return (
            <Box key={id} flexDirection="column" marginBottom={1}>
              <Text>
                <Text bold color="cyan">{id}</Text>
                {" "}
                <Text dimColor>[{entry.source}]</Text>
                {!onDisk && <Text color="red"> (missing)</Text>}
              </Text>
              <Text dimColor>  {entry.path}</Text>
              {entry.url && <Text dimColor>  {entry.url}</Text>}
            </Box>
          );
        })}
      </Box>
    );
  }

  if (status === "done") {
    return <Text color="green">{message}</Text>;
  }

  return null;
}
