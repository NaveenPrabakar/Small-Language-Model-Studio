import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Blocks,
  Cpu,
  GitBranch,
  Keyboard,
  Layers,
  Network,
  Terminal,
} from "lucide-react";

export interface DocSection {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Mini-markdown: rendered through the existing <MessageContent /> parser
   *  ( "## " headers, "- " bullets, `code`, **bold**, blank-line spacing). */
  content: string;
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: BookOpen,
    content: `SLM Studio is a local-first chat interface for **Ollama** models, with a FastAPI + SQLite backend and a React/Vite frontend.

## What it does
- Chat with any locally pulled Ollama model, streamed token-by-token over SSE
- Pin reusable behavior with **Agents** and **Skills**
- Ground answers in your own documents with **Embeddings**
- Call external tools through **MCP servers**
- Chain the above together visually with **Workflows**

## Where things live
- Conversations sit in the left sidebar and persist to SQLite
- Everything else (Models, MCP servers, Agents, Skills, Workflows, Embeddings) is configured from **Settings**, opened from the sidebar
- Model responses stream live; you'll see tokens arrive as the model generates them`,
  },
  {
    id: "directives",
    title: "Chat directives",
    icon: Terminal,
    content: `Directives are typed at the **start** of a chat message, one per line, before the rest of your message. They're stripped out before the message reaches the model.

## Available directives
- \`/agent <name>\` - prepend a saved agent's system prompt to this turn
- \`/skill <name>\` - prepend a saved skill's instructions (can be used multiple times)
- \`/useembed <name>\` - retrieve relevant chunks from an embedding collection and inject them as context
- \`/workflow <name>\` - run a saved workflow before the model responds
- \`/embed <model>\` - not a chat directive on its own; attach a file first, then send this to create a new embedding collection with that file

## Rules
- Each directive must be on its **own line** - anything else on the same line is parsed as part of the directive's argument
- Directives can be combined (e.g. an \`/agent\` line followed by a \`/skill\` line followed by your question)
- The first line that isn't a recognized directive is treated as the start of your actual message`,
  },
  {
    id: "models",
    title: "Models",
    icon: Cpu,
    content: `Models are whatever is currently pulled into your local Ollama installation, plus anything you pull from Settings.

## Badges
- **Fast** - 3B parameters or fewer
- **Balanced** - 3B to 13B parameters
- **Powerful** - over 13B parameters

## Pulling a model
- Open Settings > Models
- Enter a tag (e.g. \`llama3.2:3b\`) and click Pull model
- The model appears in the picker once the pull finishes

## Per-conversation model
Each conversation remembers the model it was created with. Switching the model from the header dropdown updates that conversation going forward; a fresh conversation starts on whatever model is currently selected.`,
  },
  {
    id: "mcp",
    title: "MCP servers",
    icon: Network,
    content: `MCP (Model Context Protocol) servers expose tools the model can call mid-conversation - things like file access, search, or custom business logic.

## Registering a server
- Open Settings > MCP servers
- Give it a name and its URL, then Add MCP server

## How tool calls work
- On each turn, the app discovers every tool across every registered server
- If any tools are available, the model is first asked (as JSON) whether it wants to call one
- If it does, the tool runs and its result is fed back in before the model's real answer streams
- Up to 3 tool-call rounds are allowed per turn before the model is asked to just answer

## Notes
- Smaller local models are less reliable at emitting the exact JSON tool-call shape - if tool calls seem to be silently ignored, try a larger model
- A server that fails to connect is skipped rather than blocking the chat`,
  },
  {
    id: "agents",
    title: "Agents",
    icon: Bot,
    content: `An agent is a saved system prompt you can drop into any conversation.

## Creating one
- Settings > Agents > enter a name and the system prompt text > Add agent

## Using one
- Start a message with \`/agent <name>\` on its own line
- The agent's system prompt is prepended to that turn only - it does not change the conversation's default behavior going forward

Agent names must be unique.`,
  },
  {
    id: "skills",
    title: "Skills",
    icon: Blocks,
    content: `A skill is a smaller, focused instruction block - e.g. "answer in bullet points" or "cite sources inline."

## Creating one
- Settings > Skills > enter a name and instructions > Add skill

## Using one
- Start a message with one or more \`/skill <name>\` lines
- Multiple skills can be stacked on the same message

Skills and agents can be combined in the same message; skill instructions are appended after the agent's system prompt.`,
  },
  {
    id: "workflows",
    title: "Workflows",
    icon: GitBranch,
    content: `Workflows are visual, drag-and-drop pipelines that bundle skills, embeddings, MCP tools, and a model override into one reusable step, invoked with \`/workflow <name>\`.

## Node types
- **Trigger** - the workflow's single entry point (exactly one per workflow)
- **Skill** - injects a saved skill's instructions
- **Embedding** - retrieves context from an embedding collection
- **MCP Tool** - restricts tool-calling to a specific server (or one specific tool on it)
- **Model** - overrides which model handles this turn
- **Output** - marks the end of the flow (no configuration needed)

## Building one
- Settings > Workflows > drag node types onto the canvas
- Click a node to configure it in the right-hand panel
- Connect nodes by clicking a node's right-side port, then the next node's left-side port
- Give the workflow a name and click Save workflow

## Execution order
Nodes run in topological order starting from the Trigger node (so upstream nodes always execute before the nodes they connect to). Any node left disconnected from the trigger still runs, just after the connected graph.

## Precedence
If a workflow's Model node sets an override, it's used unless the request itself (or the header's model picker) specifies one explicitly - the request-level choice always wins.`,
  },
  {
    id: "embeddings",
    title: "Embeddings & RAG",
    icon: Layers,
    content: `Embeddings let you ground answers in your own documents using local retrieval - no external vector database required.

## Creating a collection
- Attach a file in the composer (pdf, txt, md, json, or csv)
- Send \`/embed <embedding-model>\`, e.g. \`/embed nomic-embed-text\`
- You'll be prompted to name the collection

## Querying a collection
- Start a message with \`/useembed <collection-name>\` on its own line, followed by your question

## How it works under the hood
- Documents are split into chunks (~1000 characters, 150 character overlap) along paragraph boundaries
- Each chunk is embedded and stored in SQLite as a JSON-encoded vector
- At query time, your question is embedded and compared to every chunk with cosine similarity
- The top 5 matching chunks are injected as context before the model answers

This is a straightforward O(n) scan per query - fine for local, single-user use at up to a few thousand chunks per collection.`,
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    icon: Keyboard,
    content: `## In the composer
- \`Enter\` - send the message
- \`Shift + Enter\` - insert a newline without sending

## Sidebar
- \`Ctrl/Cmd + B\` - toggle the sidebar`,
  },
];
