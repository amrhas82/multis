# multis Blueprint

The master reference for all decisions, flows, and architecture. If it's not here, it wasn't agreed.

---

## 1. What multis Is

A personal and business AI agent that lives in your chat apps. Runs locally on your machine, indexes your documents, remembers conversations per-chat with activation decay, and auto-responds to contacts when you want it to.

**Core principles:**
- Local-first — all data on your machine
- LLM agnostic — Anthropic, OpenAI, Ollama, swap without code changes
- Governance-first — allowlist/denylist + audit logs on everything
- Vanilla Node.js — standard library first, minimal deps
- Per-chat isolation — every chat is its own world, no data leaks between them

---

## 2. Platforms

### Three paths, one config

| Path | Requires | Status |
|------|----------|--------|
| **Telegram** (mandatory) | Bot token from @BotFather | Done |
| **Beeper Desktop API** (optional) | Beeper Desktop running on localhost | Done |
| **Self-hosted Matrix** (optional) | VPS + domain, $5-10/month | Planned (POC7) |

User fills in what they have in `~/.multis/config.json`. Telegram is always available.

### Platform abstraction

```
Platform (base.js)
  ├── start(), stop(), send(chatId, text), onMessage(callback)
  │
  ├── TelegramPlatform  — Telegraf wrapper, / prefix
  ├── BeeperPlatform    — polls localhost:23373, // prefix
  └── MatrixPlatform    — (future) Matrix SDK client
```

All platforms emit normalized `Message` objects → single router handles everything.

### Message routing flow

```
Message arrives
  │
  ├─ Starts with [multis] → SKIP (our own response)
  │
  ├─ Is a command? (/ on Telegram, // on Beeper)
  │   └─ YES → parse command → switch (ask, mode, exec, read, index, search, ...)
  │
  ├─ msg.routeAs === 'natural'? (self-message in personal chat)
  │   └─ YES → routeAsk(msg.text) — implicit question
  │
  ├─ msg.routeAs === 'business'? (incoming message in business-mode chat)
  │   └─ YES → routeAsk(msg.text) — auto-respond
  │
  └─ else → IGNORE
```

### Beeper-specific

- **Self-chat detection**: at startup, identify chats with type=single + ≤1 participant
- **Mode lookup**: `config.platforms.beeper.chat_modes[chatId]` → fallback to `default_mode`
- **Self messages in personal chats**: routed as natural language (routeAs: 'natural')
- **Incoming messages in business chats**: auto-responded (routeAs: 'business')

---

## 3. Chat Modes

Two modes, per-chat, switchable anytime:

| Mode | Self messages | Incoming messages | Use case |
|------|--------------|-------------------|----------|
| **personal** (default) | Commands + natural ask | Ignored | Your notes, research, personal docs |
| **business** | Commands + natural ask | Auto-respond via LLM | Customer support, business contacts |

**Set via:** `//mode personal` or `//mode business`
**Persisted to:** `config.platforms.beeper.chat_modes[chatId]`
**Onboarding sets:** `default_mode` (personal or business) — just a default, every chat can override

---

## 4. Document Indexing + RAG

### Indexing pipeline

```
File → Parser (PDF/DOCX/MD/TXT) → Sections → Chunker → SQLite FTS5
```

- **Chunk size:** 2000 chars, 200 overlap, sentence-boundary-aware
- **Section path:** heading hierarchy preserved as JSON array
- **Activation columns:** `base_activation`, `last_accessed`, `access_count` (for ACT-R)

### RAG pipeline

```
Question → FTS5 search (top 5) → buildRAGPrompt(question, chunks) → LLM → answer with citations
```

- System prompt: "You are multis... cite sources as [filename, page X]..."
- Each chunk formatted with metadata: filename, section path, page range
- If no chunks found: "No matching documents found"
- If no LLM configured: "LLM not configured" error

### LLM providers

All support `options.system` natively:

| Provider | System prompt | Config |
|----------|--------------|--------|
| Anthropic | `body.system` field | `ANTHROPIC_API_KEY` |
| OpenAI | `role: 'system'` message | `OPENAI_API_KEY` |
| Ollama | `body.system` field | No key needed, local |

---

## 5. Memory System (POC5)

### Per-chat isolation

Every chat gets its own memory. No global state. No cross-chat contamination.

```
~/.multis/memory/chats/<chatId>/
├── profile.json      # mode, name, platform, preferences
├── recent.json       # rolling window (last ~20 messages)
├── memory.md         # LLM-summarized durable notes
└── log/
    └── YYYY-MM-DD.md # raw daily log (append-only)
```

### What each file does

| File | Written by | Read by | Purpose |
|------|-----------|---------|---------|
| `profile.json` | Router (on mode change, activity) | Router | Chat metadata + preferences |
| `recent.json` | Router (every message) | LLM calls | Conversation context window |
| `memory.md` | Capture skill (LLM) + `//remember` | LLM system prompt | Durable notes for this chat |
| `log/*.md` | Router (every message) | Indexer, human | Raw backup, searchable |

### Rolling window → capture cycle

```
Message arrives → append to recent.json + daily log
                     │
                     ▼
              recent.json > N messages?
                     │
                YES  │  NO → done
                     ▼
              Run capture skill (LLM call):
              "Here's the conversation. Extract what matters."
                     │
                     ▼
              Append extracted notes to memory.md
                     │
                     ▼
              Push full messages to indexer (FTS5 + activation)
                     │
                     ▼
              Trim recent.json to last N
```

### Capture skill

Human-written `skills/capture.md` tells the LLM what to extract:
- Decisions made
- Action items (who, what, when)
- Preferences ("I prefer...", "always do X")
- Key facts (names, dates, relationships)
- Tone/style notes

Users can write custom capture skills for different use cases. A business user might want "extract leads and follow-ups." A personal user might want "extract book recommendations and ideas."

### ACT-R activation decay

Applied to all indexed chunks (documents + conversations):

```
activation = base_activation + ln(access_count) - decay_rate × age_in_days
```

- New chunks: high activation (recently created)
- Frequently accessed: stays high (ln of access count)
- Old + untouched: fades away
- Search results ranked by: FTS5 BM25 score × activation boost

### Memory in LLM calls

```
System prompt:
  ├─ Base: "You are multis, a personal/business assistant..."
  ├─ Chat memory.md: durable notes for THIS chat
  └─ RAG chunks: document search results (if applicable)

Messages:
  ├─ recent.json: last N messages as conversation history
  └─ Current message
```

### Memory commands

| Command | What it does |
|---------|-------------|
| `//memory` | Show this chat's memory.md |
| `//forget` | Clear memory.md (keeps raw logs) |
| `//remember <note>` | Manually add a note to memory.md |

---

## 6. Governance

### Command validation
- **Allowlist:** Safe commands (ls, cat, grep, find, curl, git, etc.)
- **Denylist:** Dangerous commands (rm, sudo, dd, mkfs, shutdown)
- **Confirmation:** Risky commands (mv, cp, git push)
- **Path restrictions:** Allowed dirs (~/Documents, ~/Downloads) vs denied (/etc, /var)

### Audit logging
- Append-only JSONL at `~/.multis/audit.log`
- Every command logged: timestamp, user_id, command, allowed, result
- Actions logged: pair, unpair, exec, index, search, ask, mode change

### Owner model
- First paired user becomes owner
- Owner-only: `/exec`, `/read`, `/index`
- Everyone else: `/ask`, `/search`, `/docs`, `/status`, `/help`

---

## 7. Cron Scheduler (POC6)

Built-in scheduler, runs inside the daemon process.

### Core jobs

| Job | Frequency | What it does |
|-----|-----------|-------------|
| **Capture cycle** | Every N minutes (for active chats) | Summarize recent → memory.md → index → trim |
| **Activation decay** | On access (or periodic if needed) | Recalculate activation scores |

### User-defined jobs (future)

| Example | Schedule | Payload |
|---------|----------|---------|
| Morning brief | `0 7 * * *` | "Summarize overnight across all business chats" |
| Reminder | One-shot | "Follow up with Alice" → deliver to chat |
| Weekly digest | `0 9 * * 1` | "Summary of all customer conversations this week" |

### Storage
- Jobs: `~/.multis/cron/jobs.json`
- Run history: `~/.multis/cron/runs/<jobId>.jsonl`

---

## 8. Onboarding

```
multis init
  │
  ├─ Choose: personal or business → sets default_mode
  ├─ Telegram bot token → saved to config
  ├─ LLM provider + API key → saved to config/.env
  ├─ Beeper Desktop? → optional, runs setup-beeper.js
  └─ Generate pairing code → printed to terminal

multis start → daemon runs in background
multis stop  → daemon stops
```

**The personal/business choice is just a default.** It sets `default_mode` in config. Every chat can be switched individually with `//mode`. Testing is easy — just flip modes per-chat.

---

## 9. Configuration

### Files

| File | Location | Purpose |
|------|----------|---------|
| `config.json` | `~/.multis/` | Main config: platforms, LLM, users, modes |
| `governance.json` | `~/.multis/` | Command allowlist/denylist |
| `.env` | Project root | API keys (overrides config.json) |
| `multis.db` | `~/.multis/` | SQLite: document chunks + FTS5 |
| `audit.log` | `~/.multis/` | Append-only audit log |
| `beeper-token.json` | `~/.multis/` | Beeper Desktop API token |
| `memory/chats/` | `~/.multis/` | Per-chat profiles + memory |
| `cron/jobs.json` | `~/.multis/` | Scheduled jobs |

### Config structure

```json
{
  "pairing_code": "F71A9B",
  "owner_id": 8503143603,
  "allowed_users": [8503143603],
  "platforms": {
    "telegram": { "enabled": true, "bot_token": "..." },
    "beeper": {
      "enabled": true,
      "url": "http://localhost:23373",
      "poll_interval": 3000,
      "command_prefix": "//",
      "default_mode": "personal",
      "chat_modes": {}
    }
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5-20250929",
    "apiKey": "..."
  },
  "memory": {
    "recent_window": 20,
    "capture_interval_minutes": 15,
    "decay_rate": 0.05
  },
  "governance": { "enabled": true }
}
```

---

## 10. Skills

### What skills are

Markdown files in `skills/` that define capabilities. Two types:

1. **Governance skills** (existing): `shell.md`, `files.md`, `weather.md` — describe what commands are allowed/denied, how to use them
2. **LLM skills** (POC5+): `capture.md` — instructions for the LLM on what to extract from conversations

### Skill format

```markdown
---
name: capture
description: Extract durable notes from conversation history
---

Instructions for the LLM on what to look for and how to format output.
```

Skills are loaded and injected into LLM prompts when relevant. The capture skill is used by the cron job. Other skills could be added for specific use cases.

---

## 11. What We Borrowed and Changed

| Source | What | Our version |
|--------|------|-------------|
| **openclaw** | Daemon architecture | Same pattern, simpler (no gateway) |
| **openclaw** | Pairing flow | Same: code → send to bot → paired |
| **openclaw** | skill.md pattern | Same frontmatter format |
| **openclaw** | memory.md approach | Per-chat (not global), LLM-written |
| **openclaw** | Daily log files | Same: `YYYY-MM-DD.md` append-only |
| **openclaw** | Cron scheduler | Same pattern: jobs.json, periodic agent turns |
| **openclaw** | Pre-compaction flush | Our capture skill replaces it |
| **Aurora** | Document indexing | Ported: PDF/DOCX → chunking → FTS5 |
| **Aurora** | ACT-R activation decay | Same formula, applied to conversations too |
| **Aurora** | Hierarchical chunking | Same: section path + sentence boundaries |
| **Aurora** | SQLite FTS5 | Same, but FTS5 BM25 replaces custom scorer |
| **mcp-gov** | Governance layer | Same: allowlist/denylist JSON + audit |

### Key difference from openclaw

One config, all chats. openclaw needs separate API integrations per channel. multis talks to Telegram + Beeper bridges + Matrix — all networks through one setup. Per-chat profiles keep everything isolated without multi-tenant complexity.
