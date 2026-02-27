# @statechange/council

Build a council of AI personas and have them debate any topic. Each counsellor has their own LLM backend, model, personality, and source material. Run discussions in a structured **debate** format or an open **freeform** group chat — via the CLI, an Electron GUI, or Claude Code skills.

## Getting Started with Claude Code Skills

The fastest path is to add the skills to [Claude Code](https://claude.com/claude-code). They handle installation, configuration, counsellor creation, and running discussions for you.

```bash
npx skills add statechangelabs/ai-council
```

This gives you two skills:

| Skill | What it does |
|-------|-------------|
| `/council-manage` | Create counsellors, run discussions, manage your council. Try: *"create a counsellor based on Warren Buffett"* or *"run a debate about whether AI should be open source"* |
| `/council-setup-keys` | Finds API keys scattered across your env files and shell profiles, then imports them into `~/.ai-council/config.json` |

The skills will install the `council` CLI automatically if it's not already on your system.

## Install

```bash
# Global install (gives you the `council` command)
npm install -g @statechange/council

# Or run one-off without installing
npx @statechange/council discuss "Should we adopt microservices?"
```

## CLI

### Run a discussion

```bash
# Freeform (default) — open group chat, everyone sees everything
council discuss "Should we pivot to enterprise?" --rounds 3

# Debate — structured constructive/rebuttal format
council discuss "Should AI be open source?" --mode debate --rounds 3

# Pick specific counsellors
council discuss "Topic" --counsellors ./council/strategist ./council/critic

# Topic from a file
council discuss ./topics/architecture.md
```

### Manage counsellors

```bash
council list                                  # Show available counsellors
council counsellor add ./path/to/counsellor   # Register from local directory
council counsellor add https://github.com/user/counsellors.git  # From git
council counsellor remove my-counsellor       # Unregister
```

### View history

```bash
council history        # List past discussions
council history <id>   # View a specific discussion
```

### Configure backends

```bash
council config show                    # See what's configured
council config scan                    # Find API keys across your system
council config scan ~/project/.env     # Scan additional paths
council config import                  # Import discovered keys into config
```

### All CLI options

```
council discuss <topic> [options]

  --mode, -m          freeform or debate (default: freeform)
  --rounds, -r        Number of discussion rounds (default: 2)
  --council, -c       Path to council directory (default: ./council/)
  --counsellors       Specific counsellor directory paths (space-separated)
  --output, -o        Output directory (default: ./output)
  --format, -f        md, json, or both (default: both)
  --infographic, -i   Generate an infographic after discussion
```

## GUI

The Electron app gives you a visual interface with real-time streaming, point-and-click counsellor management, and full discussion history.

```bash
# From the cloned repo
git clone https://github.com/statechangelabs/ai-council.git
cd ai-council
bun install
bun run dev:gui
```

### What you get

- **Discussion page** — Topic input with file attachments, counsellor selection chips, freeform/debate mode toggle, real-time streaming of responses, round dividers and interim summaries in debate mode, inject messages mid-discussion
- **Counsellors page** — Browse, search, create, edit, and delete counsellors with a form editor or raw ABOUT.md editing; register external counsellors from local paths or git repos
- **History page** — Browse past discussions, view full transcripts with round summaries, copy as markdown, generate infographics
- **Settings page** — Configure API keys per backend, test connections, see available models

## Discussion Modes

### Freeform

The default. An open group chat where every counsellor sees the full conversation history on every turn. The first speaker sets the tone and later speakers react to what's been said. Counsellor order stays the same each round.

### Debate

A structured argument format designed to prevent pile-on and anchoring bias:

1. **Round 1 — Constructive**: Each counsellor argues their position based *only* on the question. They can't see what anyone else said. Even a "critic" persona has to stand up their own argument first.

2. **Rebuttal rounds (2+)**: Counsellors now see the constructive round plus *only* the previous rebuttal round — not the entire history. This keeps context growth bounded. Speaker order is shuffled each round so nobody is always first or last.

3. **Interim summaries**: If a secretary is configured, a brief summary is generated after every round, tracking emerging agreements, disagreements, and shifts in position.

## Configuration

### API Keys

Each backend needs an API key (except Ollama, which runs locally). Keys are resolved in order:

1. `~/.ai-council/config.json` (managed by `council config import` or the GUI)
2. Environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`
3. `.env` file in the working directory

### Secretary

Enable post-discussion summaries (and debate interim summaries) by adding a `secretary` block to `~/.ai-council/config.json`:

```json
{
  "backends": { "..." : "..." },
  "secretary": {
    "backend": "anthropic",
    "model": "claude-sonnet-4-5-20250929"
  }
}
```

### Supported Backends

| Backend | Default Model | API Key |
|---------|--------------|---------|
| anthropic | claude-sonnet-4-5-20250929 | `ANTHROPIC_API_KEY` |
| openai | gpt-4o | `OPENAI_API_KEY` |
| google | gemini-2.0-flash | `GOOGLE_API_KEY` |
| ollama | llama3.2 | None (local) |

## Creating Counsellors

A counsellor is a directory containing an `ABOUT.md` file with YAML frontmatter and a system prompt:

```
council/
  my-counsellor/
    ABOUT.md
    avatar.jpg    # optional
```

### ABOUT.md format

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
strategic lens to every discussion.

When contributing:
- Think about second and third-order effects
- Consider offensive and defensive strategic positions
- Ground your thinking in frameworks when relevant
- Be direct and opinionated

Keep your responses focused. Aim for 2-4 paragraphs per turn.
```

### Frontmatter fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name |
| `description` | Yes | One-line summary of this counsellor's perspective |
| `backend` | Yes | `anthropic`, `openai`, `google`, or `ollama` |
| `model` | No | Specific model ID; uses backend default if omitted |
| `temperature` | No | 0.0–2.0; higher = more creative (default varies by backend) |
| `interests` | No | Tags shown in the UI |
| `avatar` | No | Path to local image or URL |

### Included counsellors

The package ships with three starter counsellors:

| Counsellor | Backend | Perspective |
|-----------|---------|-------------|
| **The Strategist** | Anthropic (Haiku) | Strategic business advisor — positioning, growth, competitive advantage |
| **The Creative** | Anthropic (Opus) | Lateral thinker — unexpected analogies, reframing, unconventional connections |
| **The Critic** | Google (Gemini Flash) | Devil's advocate — stress-tests ideas, surfaces assumptions, finds failure modes |

### Building counsellors from source material

You can create counsellors based on real people or bodies of work by appending reference material below the system prompt. The `/council-manage` skill in Claude Code can automate this — ask it to *"create a counsellor based on [person or book]"* and it'll handle downloading source text, writing the system prompt, and assembling the ABOUT.md.

## Logging

Errors are logged to `~/.ai-council/council.log` with timestamps, context tags, and full stack traces. Check this file when a counsellor fails to respond or a summary doesn't generate.

## Development

```bash
git clone https://github.com/statechangelabs/ai-council.git
cd ai-council
bun install

bun run dev -- discuss "topic"     # CLI development
bun run dev:gui                    # GUI development
bun run build                      # Build CLI
bun run build:gui                  # Build GUI
```

## License

MIT
