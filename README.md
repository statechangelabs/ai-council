# @statechange/council

A CLI + Electron GUI for orchestrating round-robin AI counsellor discussions. Build a council of AI personas — each with their own backend, model, personality, and source material — and have them debate topics in structured or freeform formats.

## Quick Start with Claude Code Skills

The fastest way to get started is through [Claude Code](https://claude.com/claude-code) skills. Install the package, and the skills handle the rest:

```bash
npm install -g @statechange/council
```

Then in Claude Code:

- **`/council-manage`** — Create counsellors, run discussions, manage your council. Ask it to "create a counsellor based on [person]" or "run a debate about [topic]".
- **`/council-setup-keys`** — Find API keys scattered across your env files and shell profiles, then consolidate them into `~/.ai-council/config.json`.

The skills know how to use the CLI, create counsellors from source material, and troubleshoot configuration issues.

## Install

```bash
# Global install (recommended for CLI use)
npm install -g @statechange/council

# Or run directly
npx @statechange/council discuss "Should we adopt microservices?"
```

## CLI Usage

```bash
# Run a freeform discussion (default)
council discuss "Should we pivot to enterprise?" --rounds 3

# Run a structured debate
council discuss "Should AI be open source?" --mode debate --rounds 3

# Use specific counsellors
council discuss "Topic" --counsellors ./council/strategist ./council/critic

# Topic from a file
council discuss ./topics/architecture.md

# List available counsellors
council list

# View past discussions
council history
council history <id>
```

### Discussion Modes

**Freeform** (default) — Open group chat. Every counsellor sees the full conversation history on every turn. The first speaker sets the tone and later speakers react.

**Debate** — Structured argument with three key differences:
1. **Round 1 (Constructive)**: Each counsellor argues their position based only on the question — no visibility into what others said.
2. **Rebuttal rounds**: Counsellors see the constructives plus only the previous round. Speaker order is shuffled each round.
3. **Interim summaries**: A brief secretary summary after each round, creating a running debate narrative.

### Options

```
--council, -c       Path to council directory (default: ./council/)
--counsellors       Specific counsellor directory paths (space-separated)
--rounds, -r        Number of discussion rounds (default: 2)
--mode, -m          freeform or debate (default: freeform)
--output, -o        Output directory (default: ./output)
--format, -f        md, json, or both (default: both)
--infographic, -i   Generate an infographic after discussion
```

## GUI

Launch the Electron app for a visual interface with real-time streaming, counsellor management, and discussion history:

```bash
# Development
council-gui          # if installed globally
# or from source:
bun run dev:gui
```

The GUI includes:
- Counsellor selection chips with health indicators
- Freeform/Debate mode toggle with explanatory tooltips
- Real-time streaming of counsellor responses
- Round dividers and interim summaries in debate mode
- Secretary summary with Excalidraw position diagrams
- Infographic generation (OpenAI / Google)
- Full discussion history with search

## Configuration

### API Keys

Backends need API keys (except Ollama which runs locally). Keys can come from:

1. **Environment variables**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`
2. **Config file**: `~/.ai-council/config.json`
3. **`.env` file** in the project root

Use the CLI to find and import keys:

```bash
council config show              # See what's configured
council config scan              # Find keys in env files and shell profiles
council config scan ~/project/.env  # Scan additional paths
council config import            # Import discovered keys
```

Or configure in the GUI under Settings.

### Secretary

Add a `secretary` block to `~/.ai-council/config.json` to enable post-discussion summaries and debate interim summaries:

```json
{
  "backends": { ... },
  "secretary": {
    "backend": "anthropic",
    "model": "claude-sonnet-4-5-20250929"
  }
}
```

## Creating Counsellors

Each counsellor is a directory with an `ABOUT.md` file:

```
council/
  my-counsellor/
    ABOUT.md
    avatar.jpg    # optional
```

### ABOUT.md Format

```markdown
---
name: "The Strategist"
description: "Thinks in systems, moats, and long-term positioning"
interests: ["strategy", "markets", "competition"]
backend: "anthropic"
model: "claude-sonnet-4-5-20250929"
temperature: 0.7
avatar: "avatar.jpg"
---

You are The Strategist. You sit on a council of experts and bring a
strategic lens to every discussion...
```

### Supported Backends

| Backend | Default Model | API Key |
|---------|--------------|---------|
| anthropic | claude-sonnet-4-5-20250929 | `ANTHROPIC_API_KEY` |
| openai | gpt-4o | `OPENAI_API_KEY` |
| google | gemini-2.0-flash | `GOOGLE_API_KEY` |
| ollama | llama3.2 | None (local) |

### Registering External Counsellors

```bash
# From a local directory
council counsellor add ./path/to/counsellor

# From a git repository
council counsellor add https://github.com/user/my-counsellors.git

# List registered counsellors
council counsellor list

# Remove
council counsellor remove my-counsellor
```

## Logging

Errors are logged to `~/.ai-council/council.log` with timestamps, context, and full stack traces. Check this file when a counsellor fails to respond or a summary doesn't generate.

## Development

```bash
# Install dependencies
bun install

# CLI development
bun run dev -- discuss "topic"

# GUI development
bun run dev:gui

# Build CLI
bun run build

# Build GUI
bun run build:gui
```

## License

MIT
