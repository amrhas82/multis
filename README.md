# multis

**A personal chatbot and assistant that runs on your computer.**

Control your laptop and ask questions about your documents—all from Telegram.

## Why multis?

- **Local-first:** Your data never leaves your machine
- **Simple setup:** Running in <5 minutes with `npx multis init`
- **LLM agnostic:** Works with Anthropic, OpenAI, Ollama, or any other provider
- **Intelligent memory:** Remembers recent context, forgets old conversations naturally
- **Document-aware:** Indexes your PDFs and DOCX files for instant answers
- **Governance layer:** Command allowlist/denylist + audit logs for safety

## Quick Start

```bash
# Install globally
npm install -g multis

# Initialize (creates config, pairs with Telegram)
multis init

# Start daemon
multis start

# Send a message to your bot on Telegram
```

## Architecture

```
┌─────────────┐
│  Telegram   │  (Control interface)
└──────┬──────┘
       │
┌──────▼──────┐
│   multis    │  (Runs locally as daemon)
│   daemon    │
└──────┬──────┘
       │
   ┌───┴────┬──────────┬───────────┬──────────┐
   │        │          │           │          │
┌──▼──┐ ┌──▼───┐ ┌────▼────┐ ┌────▼────┐ ┌──▼────┐
│Index│ │ RAG  │ │ Memory  │ │ Skills  │ │  Gov  │
│(PDF)│ │ LLM  │ │ ACT-R   │ │(shell)  │ │(audit)│
└─────┘ └──────┘ └─────────┘ └─────────┘ └───────┘
```

## What We Borrowed

- **From openclaw:** Daemon architecture, pairing flow, skill.md pattern, memory.md approach
- **From Aurora:** Document indexing (PDF/DOCX), ACT-R memory decay, hybrid retrieval (BM25 + semantic)
- **From mcp-gov:** Command allowlist/denylist, audit logging, governance layer

## Comparison to Other Projects

- **vs. openclaw:** Borrowed patterns but simpler (no gateway, no complex plugin system). Focus on documents + personal assistant.
- **vs. Aurora:** Borrowed indexing but no code analysis. Just docs + chat.
- **vs. mcp-gov:** Borrowed governance but integrated into bot (not separate MCP server).

## Features

### Personal Assistant
- Execute shell commands (allowlisted for safety)
- List/read files
- Web search
- System info (disk, memory, CPU)
- Browser control (coming soon)

### Document Chatbot
- Upload PDFs and DOCX files
- Semantic search with BM25 + embeddings
- RAG (retrieval-augmented generation)
- Cite sources in answers

### Memory
- Conversation history per user
- ACT-R activation decay (recent = higher priority)
- memory.md files (human-readable logs)
- Automatic re-indexing

### Governance
- Command allowlist (e.g., `ls`, `grep`, `cat`)
- Command denylist (e.g., `rm`, `sudo`, `dd`)
- Confirmation prompts for risky commands
- Audit logs (append-only, tamper-evident)

## POC Roadmap

- [x] POC 1: Telegram echo bot (1 day)
- [ ] POC 2: Basic skills (shell, files) - personal assistant (1-2 days)
- [ ] POC 3: Document indexing (PDF/DOCX) (2 days)
- [ ] POC 4: LLM RAG (smart answers from docs) (1 day)
- [ ] POC 5: Memory (ACT-R + memory.md) (2 days)
- [ ] POC 6: Daemon + onboarding wizard (2 days)

## Tech Stack

- **Runtime:** Node.js (vanilla, standard library first)
- **Bot:** Telegraf (Telegram)
- **Database:** SQLite (better-sqlite3)
- **LLM:** Multi-provider (Anthropic, OpenAI, Ollama)
- **PDF:** pdf-parse
- **DOCX:** mammoth
- **Daemon:** pm2 or systemd

## Project Structure

```
multis/
├── src/
│   ├── bot/              # Telegram bot
│   ├── governance/       # Allowlist/denylist + audit
│   ├── skills/           # Shell, files, web, etc.
│   ├── indexer/          # PDF/DOCX parsing
│   ├── memory/           # SQLite + ACT-R + memory.md
│   ├── retrieval/        # BM25 + semantic search
│   ├── llm/              # Multi-provider LLM client
│   └── cli/              # Init wizard + daemon control
├── skills/               # Skill definitions (markdown)
├── docs/                 # Documentation
├── package.json
└── README.md
```

## License

MIT

---

**Status:** 🚧 In development (POC phase)
