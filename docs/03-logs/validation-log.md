# Validation Log

## POC1: Telegram Echo Bot
- [x] Bot connects to Telegram
- [x] `/start <code>` pairs user
- [x] Deep link `t.me/multis02bot?start=<code>` works
- [x] Text message → `Echo: <text>` reply
- [x] Unpaired user → rejection message

## POC2: Basic Skills
- [x] `/exec ls` → output returned
- [x] `/exec rm -rf /` → denied by governance
- [x] `/read ~/Documents/file.txt` → file contents
- [x] Audit log populated in `~/.multis/audit.log`
- [x] Non-owner user → "Owner only command"

## POC3: Document Indexing
- [x] `/index ~/path/to/file.pdf` → "Indexed N chunks"
- [x] Telegram file upload → download + index
- [x] `/search <query>` → ranked chunk results
- [x] `/docs` → shows index stats
- [x] FTS5 query tokenization handles multi-word queries

## POC4: LLM RAG + Chat Modes
Validated 2026-02-10 with live Anthropic API (Haiku 4.5) through full router path.

- [x] `/ask` command through router → LLM answers (tested with no indexed docs, correctly notes absence)
- [x] Natural language routing (`routeAs = 'natural'`) → implicit ask, LLM responds
- [x] RAG prompt builder → chunks formatted with source metadata, citations returned as `[filename, section, page X]`
- [x] `//mode personal` on Beeper → confirms, persists to config
- [x] Unpaired user → blocked with auth error, no LLM call made
- [x] `/help` → owner sees full command list including exec/read/index
- [x] System prompt passed correctly to Anthropic (`body.system` field)
- [ ] `//mode business` → auto-respond to incoming (not tested live — needs real Beeper chat)
- [ ] OpenAI provider live test (code reviewed, not API-tested)
- [ ] Ollama provider live test (code reviewed, not API-tested)

### Known limitation: provider hostnames are hardcoded
- Anthropic: `api.anthropic.com` — only works with Anthropic
- OpenAI: `api.openai.com` — won't work with OpenAI-compatible APIs (GLM, Groq, Together, vLLM)
- Ollama: configurable `baseUrl` — the only flexible provider
- **Fix needed (polish pass):** add `baseUrl` to OpenAI provider so any compatible API works

## POC7 (partial): Platform Abstraction
- [x] Beeper Desktop API connection
- [x] Self-message detection
- [x] `//` command prefix parsing
- [x] Token auth + setup wizard
