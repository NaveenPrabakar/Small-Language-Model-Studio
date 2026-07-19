# Known Issues

This is a personal, experimental project. Below is a running list of known limitations — not exhaustive, just what's been found so far.

## Tool calling / MCP

- Smaller local models (roughly under 7B parameters) frequently fail to emit the exact JSON shape required for tool-calling. When this happens, the app silently falls back to answering without tool context rather than surfacing an error — so a tool call can appear to just "not happen" with no explanation.
- `mcp_service.open_mcp_session()` uses the SSE transport exclusively. MCP servers that only speak streamable HTTP will fail to connect.
- `_discover_tools()` in `chat_service.py` swallows all exceptions per-server (`except Exception: continue`), so a misconfigured or unreachable MCP server fails silently rather than surfacing why its tools aren't available.
- Up to 3 tool-call rounds are allowed per turn before the model is forced to answer directly — a task requiring more chained tool calls will be cut off.

## Packaging / desktop app

- Windows only. No macOS or Linux build exists.
- Unsigned executable — Windows SmartScreen shows an "unrecognized publisher" warning on first run.
- No auto-update mechanism. New versions require manually downloading the latest release.
- `onefile` PyInstaller mode unpacks to a temp directory on every launch, so startup is a couple seconds slower than a native app.
- Requires Ollama to already be running before launch; there's no in-app check or friendly error state if it isn't — API calls will just fail.

## Embeddings / RAG

- Retrieval is a linear O(n) cosine-similarity scan over all stored chunks per query — fine at small scale (a few thousand chunks per collection), will slow down noticeably beyond that.
- No support for re-embedding or updating a collection in place; a changed source file means deleting and recreating the collection.

## General

- Single local SQLite database — no multi-user support, no cloud sync, no conversation export/import.
- No automated test coverage for the desktop packaging path (PyWebview + PyInstaller build itself is unverified by CI, only manually tested).

---

Found something not listed here? Open an issue.