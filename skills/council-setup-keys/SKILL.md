---
name: council-setup-keys
description: Find AI API keys scattered across env files, shell profiles, and project directories, then consolidate them into the AI Council config at ~/.ai-council/config.json. Use when setting up AI Council, when counsellors show missing API key errors, or when the user asks to configure backends.
license: MIT
metadata:
  author: ai-council
  version: "1.0"
---

# Council Setup Keys

Find and consolidate AI API keys into the AI Council configuration.

## Installation

If `council` is not already installed, install it globally from NPM:

```bash
npm install -g @statechange/council
```

Or run commands directly with `npx @statechange/council`.

## When to Use

- The user asks to set up or configure AI Council
- Counsellors are showing red / missing API key warnings
- The user wants to find their API keys from other projects
- The user says something like "find my keys", "setup my backends", or "configure API keys"

## Steps

### 1. Check current configuration status

Run the config show command to see what's already configured:

```bash
council config show
```

This shows each backend (anthropic, openai, google, ollama) and whether it has a key from the config file or environment.

### 2. Scan standard locations

Run the built-in scanner to check env files and shell profiles:

```bash
council config scan
```

This searches:
- `.env`, `.env.local`, `.env.development`, `.env.production` in the current directory
- `~/.env`, `~/.bashrc`, `~/.bash_profile`, `~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.profile`
- `~/.config/fish/config.fish`
- Current process environment variables

### 3. Search additional project directories

The built-in scanner covers standard locations, but keys are often in project `.env` files. Search common project directories for any the scanner missed:

```bash
# Search for API key assignments in .env files across common directories
grep -r "ANTHROPIC_API_KEY\|OPENAI_API_KEY\|GOOGLE_API_KEY\|GEMINI_API_KEY" \
  ~/Documents/ ~/Projects/ ~/Code/ ~/Developer/ ~/repos/ ~/src/ \
  --include=".env*" -l 2>/dev/null
```

If additional files are found, pass them to the scanner:

```bash
council config scan /path/to/found/.env /other/path/.env
```

### 4. Import discovered keys

Once you've confirmed which keys are available, import them:

```bash
council config import
```

Or with additional paths:

```bash
council config import /path/to/extra/.env
```

This writes keys to `~/.ai-council/config.json`, skipping any backend that already has a key configured.

### 5. Verify the result

Run show again to confirm all backends are configured:

```bash
council config show
```

### 6. Report to the user

Tell the user:
- Which backends are now configured
- Which backends are still missing keys (and what env var or key they need)
- That they can also configure keys in the Electron GUI under Settings
- For ollama: no key needed, just ensure ollama is running locally

## Key Environment Variables

| Backend | Env Variable | Key Prefix |
|---------|-------------|------------|
| Anthropic | `ANTHROPIC_API_KEY` | `sk-ant-` |
| OpenAI | `OPENAI_API_KEY` | `sk-` |
| Google | `GOOGLE_API_KEY` or `GEMINI_API_KEY` | `AI` |
| Ollama | (none needed) | — |

## Config File Location

`~/.ai-council/config.json`

```json
{
  "backends": {
    "anthropic": { "apiKey": "sk-ant-..." },
    "openai": { "apiKey": "sk-..." },
    "google": { "apiKey": "AI..." }
  }
}
```
