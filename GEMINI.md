# Sonomer AI

A full-stack AI-powered study assistant web application focused on UPSC preparation, coding, mathematics, and science learning. Powered by Claude Opus 4.6 via Anthropic API proxy.

# Architecture

- **Frontend**: React 18 + Vite
- **AI Backend**: Claude Opus 4.6 via Antigravity proxy (Anthropic Messages API)
- **Styling**: Vanilla CSS with custom properties, dark theme
- **State**: React useState + localStorage for conversation persistence

# Core Feature: AI Chat Interface

The entire application is a single full-screen chat interface with:

1. **Sidebar** — Conversation history, new chat, subject quick-filters (UPSC, Coding, Math, Science)
2. **Chat Area** — Full-width message display with rich text rendering
3. **Input Area** — Multi-line textarea with file and image upload support

# Subject Focus Areas

1. **UPSC Preparation** — Indian polity, history, geography, economy, current affairs, ethics, essay writing
2. **Coding** — Data structures, algorithms, Python, JavaScript, C++, system design, competitive programming
3. **Mathematics** — Calculus, algebra, linear algebra, probability, statistics, number theory
4. **Science** — Physics, chemistry, biology, quantum mechanics, thermodynamics, organic chemistry

# AI Behavior

- Uses Claude Opus 4.6 (thinking model) via streaming API
- System prompt configured as expert tutor across all focus subjects
- Supports image uploads for solving handwritten problems, diagrams, graphs
- Supports file uploads for analyzing documents, PDFs, CSVs
- Renders responses with markdown formatting, code blocks with syntax highlighting
- Streaming responses for real-time feel

# File Structure

```
src/
├── main.jsx              ← React entry point (no routing)
├── App.jsx               ← Renders ChatApp directly
├── index.css             ← Complete dark-theme stylesheet
├── components/
│   └── ChatApp.jsx       ← Full chat interface (sidebar + messages + input)
├── services/
│   └── aiService.js      ← Claude API integration (streaming + vision)
└── assets/
    ├── LA.png            ← Logo icon
    └── Sonomer.png     ← Full logo
```
