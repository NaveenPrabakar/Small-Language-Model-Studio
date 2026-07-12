# LLM Studio Backend (Ollama)

FastAPI backend for the Large Language Model UI frontend. Talks to a
**local Ollama installation** running small language models (SLMs) --
e.g. `llama3.2:1b`, `llama3.2:3b`, `qwen2.5:1.5b`, `phi3:mini`, `gemma2:2b`
-- and persists conversations/messages to SQLite.

## Prerequisites

1. **Ollama installed and running**, with at least one model pulled:
   ```bash
   ollama serve                 # if not already running as a service
   ollama pull llama3.2:3b      # or any other SLM you want to use
   ```
2. Python 3.11+

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # adjust OLLAMA_HOST / CORS_ORIGINS if needed
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now live at `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs`.

## Run tests

```bash
pytest -v
```

All Ollama calls are mocked in tests -- you do **not** need Ollama running
to run the test suite.

## API overview

| Method | Path                                     | Purpose                                   |
|--------|-------------------------------------------|--------------------------------------------|
| GET    | `/api/models`                             | List locally pulled Ollama models          |
| POST   | `/api/conversations`                      | Create a conversation (`{model_id}`)       |
| GET    | `/api/conversations`                      | List conversations, most recent first      |
| GET    | `/api/conversations/{id}`                 | Get one conversation                        |
| PATCH  | `/api/conversations/{id}`                 | Rename / change model                       |
| DELETE | `/api/conversations/{id}`                 | Delete a conversation and its messages      |
| GET    | `/api/conversations/{id}/messages`        | Full message history                        |
| POST   | `/api/conversations/{id}/chat`            | Send a message, stream the reply (SSE)      |
| GET    | `/api/health`                             | Liveness check                              |

### Model badges

`/api/models` classifies each pulled model as `Fast` / `Balanced` /
`Powerful` based on parameter count (`<=3B` / `<=13B` / `>13B`), matching
the frontend's existing model-picker badge styling. This is a heuristic,
not a benchmark -- tune the thresholds in
`app/services/model_service.py::_badge_for` if you disagree with where a
particular model lands.

### Streaming protocol

`POST /api/conversations/{id}/chat` returns `text/event-stream` with these
event types, in order:

```
event: user_message      data: {"id": "...", "content": "..."}
event: token              data: {"delta": "Hel"}
event: token              data: {"delta": "lo!"}
event: done                data: {"eval_count": 12, "eval_duration_ns": ..., "total_duration_ns": ...}
event: assistant_message data: {"id": "...", "content": "Hello!"}
```

or, on failure mid-generation:

```
event: error data: {"detail": "..."}
```

Any tokens streamed before the failure are still persisted as a partial
assistant message, so the conversation isn't silently truncated.

## Wiring into the frontend

`frontend-integration/api.ts` is a ready-to-drop-in typed client matching
the shapes the frontend shell already expects (model `id`/`name`/`provider`/`badge`,
message `role`/`content`). Copy it to
`Frontend/Large Language Model UI/src/app/lib/api.ts`, set
`VITE_API_BASE_URL` in a `.env` file at the frontend root if the backend
isn't on `localhost:8000`, and replace the mocked `MODELS` constant /
`handleSend` timer in `AppShell.tsx` with:

```ts
import { listModels, createConversation, streamChat } from "./lib/api";

// on mount: const models = await listModels();
// on first send: const conversation = await createConversation(selectedModel.id);
// on send:
streamChat(conversation.id, inputValue, {
  onToken: (delta) => appendToLastAssistantMessage(delta),
  onError: (detail) => showErrorToast(detail),
});
```

## Design notes / assumptions

- **Why Ollama's native `/api/chat` instead of its OpenAI-compat endpoint?**
  Native streaming gives per-token deltas plus eval timing/count stats,
  which is useful for a "local model" oriented UI (e.g. showing tokens/sec
  later). Swapping to the OpenAI-compat endpoint would only require
  changes in `app/ollama_client.py`.
- **Why SQLite?** Zero external services to stand up for a project this
  size; the async SQLAlchemy layer means swapping to Postgres later is a
  one-line `DATABASE_URL` change plus adding `asyncpg` to requirements.
- **Streaming + DB sessions**: `chat_service.stream_chat_turn` opens its
  own database session (`app.database.session_scope`) instead of reusing
  the request-scoped `Depends(get_db)` session. FastAPI tears down
  generator dependencies as soon as the route handler *returns*, which for
  a `StreamingResponse` happens before the streamed body actually runs --
  reusing the request session there closes it mid-stream. This is covered
  by `tests/test_chat_router.py`.
- **Context window**: only the last `MAX_CONTEXT_MESSAGES` (default 20)
  messages are sent to Ollama per turn, to keep prompt size bounded for
  small models with short context windows. Tune via `.env`.
- **Not implemented (out of scope for this pass)**: auth/multi-user
  support (everything is a single shared workspace), model pulling from
  the API (use `ollama pull` directly), and message editing/regeneration
  endpoints -- all straightforward additions on top of this structure if
  needed.
