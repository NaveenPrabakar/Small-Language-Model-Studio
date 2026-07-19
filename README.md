# SLM Studio

A local-first desktop chat app for running Ollama models on Windows — FastAPI backend, SQLite persistence, React/Vite frontend, packaged as a standalone `.exe` with PyWebview + PyInstaller.

> ⚠️ **Experimental / personal project.** Not production-hardened. See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) before relying on it for anything important.

## Features

- Chat with any locally pulled Ollama model, streamed token-by-token over SSE
- **Agents** — reusable system prompts, invoked with `/agent <name>`
- **Skills** — reusable instruction snippets, invoked with `/skill <name>`
- **Embeddings / RAG** — attach a file, embed it, retrieve relevant chunks with `/useembed <name>`
- **MCP servers** — register remote tool servers; the model can call tools mid-conversation
- **Workflows** — visual drag-and-drop pipelines chaining skills, embeddings, and MCP tools, invoked with `/workflow <name>`

## Requirements

- [Ollama](https://ollama.com) installed and running locally (`ollama serve`)
- Windows 10/11 (only platform currently built/tested)

## Download

Grab the latest `.exe` from [Releases](../../releases) — no install needed, just run it. Ollama must already be running.

Windows SmartScreen will flag it as unrecognized on first run (it's unsigned) — click **More info → Run anyway**.

## Running from source

### Backend

```powershell
cd Backend\files
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Copy `.env.example` to `.env` and adjust as needed (Ollama host, CORS origins, context window size, etc.).

### Frontend (dev mode)

```powershell
cd "Frontend\Large Language Model UI"
npm install
npm run dev
```

Runs on `http://localhost:5173`, talking to the backend at `http://localhost:8000`.

## Building the desktop exe

```powershell
# 1. Build the frontend
cd "Frontend\Large Language Model UI"
npm run build

# 2. Copy the build output into the backend (contents, not the dist folder itself)
Copy-Item -Recurse -Force "dist\*" "..\..\Backend\files\frontend_dist\"

# 3. Install packaging deps and build
cd "..\..\Backend\files"
pip install -r requirements.txt pyinstaller pywebview
pyinstaller slm_studio.spec
```

Output: `Backend\files\dist\SLMStudio.exe`

## Architecture

Ollama (separate install, localhost:11434)
↑
FastAPI backend — async SQLAlchemy/SQLite, MCP client, embedding pipeline
↑
Static frontend served same-origin (no CORS in packaged mode)
↑
PyWebview window wrapping the FastAPI server
↑
PyInstaller onefile .exe

## Chat directives

| Directive | Effect |
|---|---|
| `/agent <name>` | Prepend a saved agent's system prompt |
| `/skill <name>` | Prepend a saved skill's instructions (stackable) |
| `/useembed <name>` | Inject retrieved context from an embedding collection |
| `/workflow <name>` | Run a saved workflow before responding |
| `/embed <model>` | Attach a file first, then send this to create an embedding collection |

Each directive must be on its own line at the start of the message.

## Tech stack

- **Backend:** FastAPI, SQLAlchemy (async), aiosqlite, Pydantic v2, httpx
- **Frontend:** React, Vite, TypeScript, Tailwind, shadcn/ui, native HTML5 drag API for the workflow canvas
- **Packaging:** PyWebview + PyInstaller

## License

MIT — see [LICENSE](./LICENSE). See [ATTRIBUTIONS.md](./Frontend/Large%20Language%20Model%20UI/ATTRIBUTIONS.md) for third-party UI component and asset credits.