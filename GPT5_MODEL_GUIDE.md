**Summary (blunt + useful):**
OpenAI's current "GPT-5" family comes in three sizes—**gpt-5**, **gpt-5-mini**, **gpt-5-nano**—plus specialized variants like **GPT-5-Codex**. Use **gpt-5** when quality and complex tool-use matter; **mini** when you need 70–90% of that capability for far less cost/latency; **nano** when you need massive scale, deterministic flows, or background agents. Reasoning controls now let you pick **reasoning_effort** (*low/medium/high*) and nudge **verbosity** (*low/medium/high*) to trade accuracy vs. speed and wall-of-text vs. concise. Built-in tools (web search, file search, deep-research, computer-use, image gen, code-interpreter) are first-class in the **Responses API**. ([OpenAI Platform][1])

---

# The GPT-5 lineup (what each is for)

**gpt-5 (flagship)** – Best general model for **agentic coding**, long tool chains, multi-file reasoning, and mixed text+vision. It's designed to "think longer when needed," supports big contexts, and is tuned for tool reliability. If you only pick one model for an AI coding agent, pick this. ([OpenAI][2])

**gpt-5-mini** – Same APIs, smaller brain. Use when prompts are well-scoped (e.g., unit tests, refactors, structured transforms, short research pulls) and you want **lower cost/latency**. OpenAI's docs explicitly position mini/nano as cheaper and faster with some knowledge trade-off. ([OpenAI Platform][3])

**gpt-5-nano** – Cheapest, fastest member. Great for **high-volume** reranking, templated code edits, log triage, spec-to-JSON extraction, and agent "planner/executor" micro-steps. It's the right default for background workers where you can retry or backstop with a larger model. ([OpenAI Platform][1])

**GPT-5-Codex (specialized)** – Tuned for **agentic, real-world software engineering** (multi-hour tasks, code review, refactors). Available via **Responses API** only; prompting differs from base GPT-5 and (per the cookbook) it does **not** support the verbosity parameter. Use for long coding sessions and autonomous code work. ([OpenAI][4])

Key capability notes frequently highlighted by OpenAI for GPT-5 family: bigger contexts, stronger instruction following/steerability, and improved tool-calling reliability vs earlier families. ([OpenAI][2])

---

# Reasoning + output controls (how "hard" it thinks vs. how much it says)

**Reasoning effort** (`reasoning_effort: "low" | "medium" | "high"`):

* *low* → favors speed and token economy
* *high* → deeper deliberation when problems are hard
  Use **low** for snappy UIs, **medium** for most coding, **high** for thorny debugging/architecture or when tool plans keep failing. ([OpenAI Platform][5])

**Verbosity** (`text: { verbosity: "low" | "medium" | "high" }`):
A GPT-5-specific nudge that changes **final answer length/style** without re-prompting. Keep global default **low** in interactive IDE UIs; bump to **high** for audits, teaching, or hand-offs. (Docs and cookbook show it as a parameter under `text`.) ([OpenAI Cookbook][6])

> Older o-series guides referenced only the effort control; GPT-5 adds an explicit verbosity control to separate "thinking length" from "output length." ([OpenAI Platform][7])

---

# Built-in tools your agent should know about

**Web Search + Deep Research** – First-class tools in **Responses API**; the model can issue `web_search_call` actions, aggregate multiple sources, and synthesize reports. Use for citations, market scans, library/API doc lookups, changelogs, and live pricing. ([OpenAI Platform][8])

**File Search** – Vector retrieval over uploaded docs, with tunable k and ranking—your RAG backbone. Use for codebase summaries, ADRs, design docs, runbooks, and private package READMEs. ([OpenAI Platform][9])

**Computer Use** – Lets the model operate apps/OS surfaces (automations). Gate with strict allow-lists and logs. Useful for "open VS Code, run tests, read failing spec" or "spin up a dev server and capture logs." ([OpenAI Platform][10])

**Images (generation/edit)** – Use **gpt-image-1** to create/modify images (diagrams, UI mocks). Great for quickly drafting UI wireframes or architecture sketches from text. ([OpenAI Platform][11])

**Code Interpreter** – Sandboxed Python for calculations, plots, and quick data work inside the same run. Handy for unit-test generation or static analysis bursts. (Listed as a supported tool in model pages.) ([OpenAI Platform][12])

**Realtime** – Low-latency streaming voice/AV control loops (e.g., pair-programming with voice or cockpit-style assistants). ([OpenAI][13])

**MCP servers & Actions** – Bring your own tool catalogs (OpenAPI actions or MCP) for databases, CI, JIRA, Git, cloud ops, etc. Use when you need typed, auditable function calls across your infra. ([OpenAI Platform][14])

---

# Strengths vs. limitations (so you don't get paged later)

**Strengths**

* **Tool reliability & agentic chains** (GPT-5 > mini > nano). Particularly strong for multi-step coding tasks and orchestrating tools via Responses. ([OpenAI][2])
* **Controllability** via `reasoning_effort` and `verbosity`, reducing prompt gymnastics for speed vs. detail trade-offs. ([OpenAI Platform][5])
* **First-class web+RAG** for grounded answers; Deep Research can synthesize across many sources. ([OpenAI Platform][15])

**Limitations**

* **Latency/cost scale with effort**; "high" effort can be slow/expensive—budget guardrails matter. ([OpenAI Platform][5])
* **Mini/Nano trade knowledge for speed**; expect more retrieval/tool reliance to close gaps. ([OpenAI Platform][7])
* **Model/snapshot drift**; lock snapshots where determinism matters. ([OpenAI Platform][12])
* **Specialized models have quirks** (e.g., GPT-5-Codex prompting differs; cookbook notes no `verbosity` support). Test prompts separately before swapping. ([OpenAI Cookbook][16])

---

# Choosing quickly (rules of thumb)

* **Interactive editor UX / tight feedback** → `gpt-5-mini` with `reasoning_effort:"low"`, `verbosity:"low"`; escalate to `gpt-5` when stuck. ([OpenAI Platform][7])
* **Autonomous refactor/review/feature work** → `gpt-5` or `GPT-5-Codex` + File/Web/Computer-Use tools; `effort:"medium|high"`. ([OpenAI][4])
* **Mass transforms / classification / schema fills** → `gpt-5-nano` with File Search; retry policy + fallbacks. ([OpenAI Platform][1])
* **Live facts/comparisons** → enable **Web Search** or **Deep Research** with mini/nano and cache results. ([OpenAI Platform][8])

---

# How to call them

## 1) Plain reasoning call (Python, Responses API)

```python
from openai import OpenAI
client = OpenAI()

resp = client.responses.create(
    model="gpt-5-mini",                      # gpt-5 | gpt-5-mini | gpt-5-nano
    input=[{"role":"user","content":"Summarize this repo's architecture from the README: <paste>"}],
    reasoning={"effort":"low"},              # low | medium | high
    text={"verbosity":"low"}                 # low | medium | high (GPT-5 family)
)
print(resp.output_text)
```

Reasoning effort and verbosity are documented in GPT-5 guides; Responses API is the recommended surface for reasoning models. ([OpenAI Platform][5])

## 2) With **function calling** (custom tools)

```python
tools=[{
  "type":"function",
  "function":{
    "name":"open_pr",
    "description":"Open a GitHub PR with provided branch and diff",
    "parameters":{
      "type":"object",
      "properties":{
        "branch":{"type":"string"},
        "title":{"type":"string"},
        "diff":{"type":"string"}
      },
      "required":["branch","title","diff"]
}}}]

resp = client.responses.create(
  model="gpt-5",
  input="Create a PR for this fix; write a clear title and include the diff.",
  tools=tools
)
# Inspect resp.output for tool calls, then execute your function(s), then return results.
```

Free-form function calling is the standard way to wire your own APIs. ([OpenAI Platform][17])

## 3) With **built-in Web Search** (no server tool needed)

```python
resp = client.responses.create(
  model="gpt-5",
  input="Compare Vite and Next.js for a new SPA; cite sources.",
  tools=[{"type":"web_search"}],
  reasoning={"effort":"medium"}, text={"verbosity":"medium"}
)
```

The Responses API exposes **web_search** as a built-in tool; Deep Research extends this to multi-source syntheses. ([OpenAI Platform][8])

## 4) **File Search (RAG)** over your docs

```python
vs = client.vector_stores.create(name="docs")
# upload files then attach to the run:
resp = client.responses.create(
  model="gpt-5-mini",
  input="Summarize our ADRs about auth and list risks.",
  tools=[{
    "type":"file_search",
    "file_search": {"vector_store_ids":[vs.id], "max_num_results": 8}
  }]
)
```

Use File Search for private knowledge; tune `max_num_results` to reduce noise. ([OpenAI Platform][9])

## 5) **Computer Use** (caution: powerful)

```python
resp = client.responses.create(
  model="gpt-5",
  input="Open VS Code, run tests, and paste failing trace here.",
  tools=[{"type":"computer_use"}]
)
```

Enable only on trusted machines with audit logs and allow-lists. ([OpenAI Platform][10])

## 6) **Image generation** (UI mocks/diagrams)

```python
img = client.images.generate(
  model="gpt-image-1",
  prompt="Wireframe of a minimal floating macOS chat bar UI in top-right."
)
with open("ui_mock.png","wb") as f: f.write(img.data[0].b64_json.decode("base64"))
```

Use **gpt-image-1** for image gen/edit. ([OpenAI Platform][11])

---

# Practical defaults for coding agents

* **Editor chat (fast loop):** `gpt-5-mini`, `effort:"low"`, `verbosity:"low"`. Elevate to `medium` only on unclear specs/tests. ([OpenAI Platform][7])
* **Autonomous tasks >10 min:** `gpt-5` or `GPT-5-Codex`, `effort:"medium"`, enable **File Search** and **Web Search**; checkpoint artifacts every N minutes. ([OpenAI][4])
* **Bulk transforms/linters:** `gpt-5-nano`, explicit schemas, deterministic prompts; fallback to mini on low-confidence. ([OpenAI Platform][1])
* **Explain/code-review for juniors:** bump `verbosity:"high"` (except Codex which may not support it), keep `effort:"low|med"` unless debugging is failing. ([OpenAI Cookbook][16])

---

# Pricing & snapshots (quick heads-up)

Model pages and the "Compare models" table list current input/output pricing and context sizes; use those to set budgets and select snapshots for deterministic runs. (Numbers change—don't hard-code.) ([OpenAI Platform][18])

---

# Migration + production notes

* Prefer **Responses API** for GPT-5 + tools; the older Chat Completions API works but loses features/perf for reasoning workflows. ([OpenAI Platform][5])
* Pin **snapshots** for critical paths; evaluate before upgrading. ([OpenAI Platform][12])
* Add **guardrails**: max tokens, max tool calls/run, circuit-breakers on `effort:"high"` loops. (OpenAI's production best-practices guide covers this mindset.) ([OpenAI Platform][19])

---

If you want, I can compress this into a one-page "model & tool chooser" for your agents (with copy-paste code blocks) or wire a small policy that auto-picks model/effort/verbosity from task metadata.

[1]: https://platform.openai.com/docs/models?utm_source=chatgpt.com "Models - OpenAI API"
[2]: https://openai.com/index/introducing-gpt-5-for-developers/?utm_source=chatgpt.com "Introducing GPT‑5 for developers"
[3]: https://platform.openai.com/docs/models/gpt-5-mini?utm_source=chatgpt.com "Model - OpenAI API"
[4]: https://openai.com/index/introducing-upgrades-to-codex/?utm_source=chatgpt.com "Introducing upgrades to Codex"
[5]: https://platform.openai.com/docs/guides/reasoning?utm_source=chatgpt.com "Reasoning models - OpenAI API"
[6]: https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools?utm_source=chatgpt.com "GPT-5 New Params and Tools"
[7]: https://platform.openai.com/docs/guides/latest-model?utm_source=chatgpt.com "Using GPT-5 - OpenAI API"
[8]: https://platform.openai.com/docs/guides/migrate-to-responses?utm_source=chatgpt.com "Migrate to the Responses API"
[9]: https://platform.openai.com/docs/guides/tools-file-search?utm_source=chatgpt.com "File search - OpenAI API"
[10]: https://platform.openai.com/docs/guides/tools-computer-use?utm_source=chatgpt.com "Computer use - OpenAI API"
[11]: https://platform.openai.com/docs/guides/image-generation?utm_source=chatgpt.com "Image generation - OpenAI API"
[12]: https://platform.openai.com/docs/models/gpt-4.1?utm_source=chatgpt.com "Model - OpenAI API"
[13]: https://openai.com/news/?utm_source=chatgpt.com "OpenAI News"
[14]: https://platform.openai.com/docs/actions/getting-started?utm_source=chatgpt.com "Getting started with GPT Actions - OpenAI API"
[15]: https://platform.openai.com/docs/guides/deep-research?utm_source=chatgpt.com "Deep research - OpenAI API"
[16]: https://cookbook.openai.com/examples/gpt-5-codex_prompting_guide?utm_source=chatgpt.com "GPT-5-Codex Prompting Guide"
[17]: https://platform.openai.com/docs/guides/function-calling?utm_source=chatgpt.com "Function calling - OpenAI API"
[18]: https://platform.openai.com/docs/models/compare?model=gpt-5&utm_source=chatgpt.com "Compare models - OpenAI API"
[19]: https://platform.openai.com/docs/guides/production-best-practices?utm_source=chatgpt.com "Production best practices - OpenAI API"
