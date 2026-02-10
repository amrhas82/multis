---
name: capture
description: Extract durable notes from conversation history for per-chat memory
---

# Conversation Capture

You are reviewing a conversation from a chat. Extract only what's worth remembering long-term. Skip small talk, greetings, and filler.

## What to extract

**Decisions made**
- What was decided, by whom, when
- "We agreed to..." or "Let's go with..."

**Action items**
- Who needs to do what, by when
- Follow-ups, next steps, deadlines

**Preferences stated**
- "I prefer...", "Always do X", "Don't ever..."
- Communication style, formatting preferences

**Key facts**
- Names, roles, relationships
- Dates, numbers, amounts
- Products, services, accounts mentioned

**Context that would be lost**
- Why a decision was made (not just what)
- Constraints or blockers mentioned
- Emotional tone if relevant (frustrated, happy, urgent)

## Output format

Bullet points, concise, present tense. Group by category. Skip categories with nothing to report.

```
## Decisions
- Using Anthropic for LLM provider (chosen over OpenAI for cost)

## Action items
- Alice to send contract by Friday
- Follow up on invoice #1234 next week

## Preferences
- Prefers formal tone in customer messages
- Wants responses under 3 sentences

## Key facts
- Alice is the project lead at Acme Corp
- Budget is $50k for Q1
```

## What NOT to capture

- Greetings, sign-offs, pleasantries
- Questions that were fully answered (capture the answer, not the question)
- Repeated information already in memory
- Technical debugging back-and-forth (capture the resolution only)
