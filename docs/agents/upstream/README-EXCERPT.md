<!-- Vemoki: excerpt only for catalog context. Do NOT run upstream install.sh
     or Agency Agents app to load the full roster into Cursor alwaysApply rules.
     See ../README.md and PROVENANCE.md. Snapshot: agency-agents@652b2692. -->

# 🎭 The Agency: AI Specialists Ready to Transform Your Workflow

> **A complete AI agency at your fingertips** - From frontend wizards to Reddit community ninjas, from whimsy injectors to reality checkers. Each agent is a specialized expert with personality, processes, and proven deliverables.

[![GitHub stars](https://img.shields.io/github/stars/msitarzewski/agency-agents?style=social)](https://github.com/msitarzewski/agency-agents)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://makeapullrequest.com)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?logo=github)](https://github.com/sponsors/msitarzewski)
[![Download the app](https://img.shields.io/github/v/release/msitarzewski/agency-agents-app?label=Download%20app&color=2563eb)](https://github.com/msitarzewski/agency-agents-app/releases/latest)

> ### 🆕 There's an app now
>
> **[Agency Agents](https://agencyagents.app)** is a native app for **macOS, Linux & Windows** that browses the entire roster and installs it into Claude Code, Cursor, Codex, Gemini, Osaurus, and more — with a click. No clone, no scripts, and it auto-updates.
>
> **→ [Download the latest release](https://github.com/msitarzewski/agency-agents-app/releases/latest) · [agencyagents.app](https://agencyagents.app)**

---

## 🚀 What Is This?

Born from a Reddit thread and months of iteration, **The Agency** is a growing collection of meticulously crafted AI agent personalities. Each agent is:

- **🎯 Specialized**: Deep expertise in their domain (not generic prompt templates)
- **🧠 Personality-Driven**: Unique voice, communication style, and approach
- **📋 Deliverable-Focused**: Real code, processes, and measurable outcomes
- **✅ Production-Ready**: Battle-tested workflows and success metrics

**Think of it as**: Assembling your dream team, except they're AI specialists who never sleep, never complain, and always deliver.

---

## ⚡ Quick Start

### Option 1: Install the app (Recommended)

The fastest way in — no clone, no terminal. [**Agency Agents**](https://agencyagents.app) is a native desktop app (macOS · Linux · Windows) that browses the whole roster and installs agents into Claude Code, Cursor, Codex, Gemini CLI, OpenCode, Qwen, and Osaurus for you, then keeps them up to date.

**[⬇ Download the latest release](https://github.com/msitarzewski/agency-agents-app/releases/latest)** — or on a Mac:

```bash
brew install --cask msitarzewski/agency-agents/agency-agents
```

Prefer the command line? The script-based options below install the same agents.

### Option 2: Use with Claude Code

```bash
# Install all agents to your Claude Code directory
./scripts/install.sh --tool claude-code

# Or manually copy a category if you only want one division
cp engineering/*.md ~/.claude/agents/

# Then activate any agent in your Claude Code sessions:
# "Hey Claude, activate Frontend Developer mode and help me build a React component"
```

### Option 3: Use as Reference

Each agent file contains:
- Identity & personality traits
- Core mission & workflows
- Technical deliverables with code examples
- Success metrics & communication style

Browse the agents below and copy/adapt the ones you need!

### Option 4: Use with Other Tools (GitHub Copilot, Antigravity, Gemini CLI, OpenCode, OpenClaw, Cursor, Aider, Windsurf, Kimi Code, Codex, Osaurus, Hermes, Mistral Vibe, DeepSeek Harness)

```bash
# Step 1 -- generate integration files for all supported tools
./scripts/convert.sh

# Step 2 -- install interactively (auto-detects what you have installed)
./scripts/install.sh

# Or target a specific tool directly
./scripts/install.sh --tool antigravity
./scripts/install.sh --tool gemini-cli
./scripts/install.sh --tool opencode
./scripts/install.sh --tool copilot
./scripts/install.sh --tool openclaw
./scripts/install.sh --tool cursor
./scripts/install.sh --tool aider
./scripts/install.sh --tool windsurf
./scripts/install.sh --tool kimi
./scripts/install.sh --tool codex
./scripts/install.sh --tool osaurus
./scripts/install.sh --tool hermes
./scripts/install.sh --tool vibe
./scripts/install.sh --tool dsh
```

**Install only the teams you need** (not everyone wants every division):

```bash
./scripts/install.sh                                    # interactive wizard: pick tools + teams
./scripts/install.sh --tool claude-code --division engineering,security
./scripts/install.sh --tool cursor --agent frontend-developer,ui-designer
./scripts/install.sh --list teams                       # see every team + agent count
./scripts/install.sh --tool opencode --division engineering --dry-run
```

`--agent` and `--agents-file` take an agent's slug (as `--list agents` prints it), its display name, or its file name without `.md` — the id the [runbook rosters](strategy/runbooks.json) use — so a runbook's team installs as listed:

```bash
python3 -c 'import json, sys
for r in json.load(open("strategy/runbooks.json"))["runbooks"]:
    if r["slug"] == sys.argv[1]: [print(a) for g in r["roster"] for a in g["agents"]]' startup-mvp > team.txt
./scripts/install.sh --tool claude-code --agents-file team.txt
```

> **OpenCode note:** OpenCode's runtime currently registers only ~119 agents and silently drops the rest ([upstream bug](https://github.com/anomalyco/opencode/issues/27988)). Installing a subset with `--division` keeps you under that limit. The installer warns you when a selection would exceed it.

See the [Multi-Tool Integrations](#-multi-tool-integrations) section below for full details.

---

## 🎨 The Agency Roster
