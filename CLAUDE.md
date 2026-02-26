# AI Council

A CLI + Electron GUI for orchestrating round-robin AI counsellor discussions.

## Project Structure

- `src/core/` — Core modules (no UI dependencies): conversation engine, counsellor loader, key scanner
- `src/backends/` — LLM backend providers: anthropic, openai, google, ollama
- `src/commands/` — CLI commands (React/Ink components): discuss, list, config
- `src/electron/` — Electron main process, preload, IPC handlers
- `src/renderer/` — React GUI (Tailwind + shadcn, built with Vite)
- `council/` — Sample counsellor definitions (ABOUT.md with YAML frontmatter)

## Key Files

- `~/.ai-council/config.json` — User config (API keys, base URLs per backend)
- `council/*/ABOUT.md` — Counsellor definitions (frontmatter: name, backend, model, temperature, interests)

## Commands

```bash
# CLI
bun run dev -- discuss "topic"        # Run a discussion
bun run dev -- list                   # List counsellors
bun run dev -- config show            # Show config status
bun run dev -- config scan [paths..]  # Scan for API keys
bun run dev -- config import          # Import found keys to config

# GUI
bun run dev:gui                       # Launch Electron app

# Build
bun run build                         # Compile CLI (tsc)
bun run build:gui                     # Build Electron app (vite)
```

## Configuration

Backends need API keys (except ollama). Keys can come from:
1. Environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`
2. Config file: `~/.ai-council/config.json`
3. `.env` file in the project root

Use `council config scan` to find keys across env files and shell profiles,
then `council config import` to consolidate them into the config file.
