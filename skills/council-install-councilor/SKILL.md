---
name: council-install-councilor
description: Install councilors from git repos, local directories, or shared collections. Use when the user wants to add an existing councilor they didn't create — from GitHub, a team repo, or a local path. Also handles multi-councilor repos that contain several councilors in one repository.
license: MIT
metadata:
  author: ai-council
  version: "1.0"
---

# Install a Councilor

Add existing councilors to your AI Council from git repos or local directories.

## Prerequisites

```bash
which council || npm install -g @statechange/council
```

## When to Use

- The user wants to install a councilor from GitHub or another git host
- The user has a local directory with councilor(s) they want to register
- The user wants to install a shared collection of councilors from a team repo
- The user says "add councilor", "install councilor", "import councilor", or "get councilor from..."

## Procedure

### Install from a Git Repository

```bash
council councilor add https://github.com/user/councilor-repo.git
```

What happens:
1. The repo is cloned to `~/.ai-council/councilors/<repo-name>/`
2. If the repo root has an `ABOUT.md`, it's registered as a single councilor
3. If the repo root has NO `ABOUT.md`, child directories are scanned — each one with an `ABOUT.md` is registered as a separate councilor (multi-councilor repo)

URL detection: anything starting with `http://`, `https://`, or ending with `.git` is treated as a git URL.

### Install from a Local Directory

```bash
council councilor add /path/to/councilor-directory
```

The directory must contain an `ABOUT.md` with valid YAML frontmatter. The councilor is registered by reference (not copied) — it stays where it is on disk.

### Install Multiple from a Local Collection

If you have a directory containing multiple councilor subdirectories:

```bash
# Register each subdirectory individually
for d in /path/to/collection/*/; do
  if [ -f "$d/ABOUT.md" ]; then
    council councilor add "$d"
  fi
done
```

### Verify Installation

```bash
# List all registered councilors
council councilor list

# Or see full details
council list
```

## Managing Installed Councilors

### List registered councilors

```bash
council councilor list
```

Shows each councilor's ID, source (local/git), path, and when it was added.

### Remove a councilor

```bash
# Unregister only (keeps files on disk)
council councilor remove councilor-id

# Unregister AND delete cloned files (for git-sourced councilors)
council councilor remove councilor-id --yes
```

### Update a git-sourced councilor

Git-sourced councilors are cloned repos. To update:

```bash
cd ~/.ai-council/councilors/councilor-name
git pull
```

## Troubleshooting

### "No ABOUT.md found"

The directory must contain an `ABOUT.md` at its root with valid YAML frontmatter (name, description, backend, interests).

### Councilor shows but won't work in discussions

Check that the councilor's backend has a configured API key:

```bash
council config show
```

### Councilor from git repo not appearing

For multi-councilor repos, each councilor subdirectory needs its own `ABOUT.md`. Check the cloned directory:

```bash
ls ~/.ai-council/councilors/repo-name/
```
