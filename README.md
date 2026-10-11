# QuietWindow

A household noise negotiator, built as a simulated Alexa+ web experience for the Amazon Developer Hackathon.

Live demo (free hosting, may take about a minute to wake up): https://quietwindow.onrender.com/

Fictional people only. Maya, Arun and Leo share a home. Each declares quiet windows (a client call, a nap, reading time) in rooms. QuietWindow plans six noisy chores around those windows using a declared sound-reach map between rooms. There are no microphones and no measured sound.

## Status, said plainly

- The request reader has two modes. By default it is an offline, deterministic parser with no language model. If a `GEMINI_API_KEY` environment variable is set, a Gemini model reads the one-sentence request instead, and its answer is checked against the household before use. On any error or without a key it falls back to the offline parser. Neither reader can approve or save a plan, and the page and `/api/health` say which mode is live. Planning, negotiation and the mediator steps stay deterministic.
- Simulated Alexa+ experience in a web page. It is not a deployed Alexa skill.
- The tool layer is exposed in two ways: inside the web app, and as a small MCP-style JSON-RPC endpoint at `/mcp` (initialize, tools/list, tools/call). It is a plain implementation of the protocol messages, not tested against a real Alexa+ account.
- Sessions are stored in SQLite on free hosting, so demo data can reset on restart.

## What it does

1. Type or speak a change, for example "Maya's call moved to 4pm". Voice uses the browser's own speech recognition when the browser has it.
2. The reader turns it into typed tool calls (get_household, update_quiet_window, propose_plans). It shows what it understood and asks a question when unclear. Nothing changes until you press apply. There is no approve tool.
3. It proposes plans: Smallest change (keeps valid chores where they were), Finish earlier, Keep afternoon open.
4. Every chore gets a reason: kept, moved, new, or not placed, with the cause.
5. For chores that cannot fit, it lists costed options: extend the deadline, ask a person to shift their window (that is their decision, the app only suggests it), or skip today.
6. Approval is bound to the household revision. Changing a window invalidates it. Saving an incomplete plan needs a second confirmation.


## Run locally

Needs Node 22.5 or newer (built-in SQLite).

```
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3001. For development, run `npm run server` and `npm run dev` in two terminals.

Tests:

```
npm test                  # unit tests
node tests/api-check.mjs  # API and MCP checks (starts its own server)
node tests/ui-check.mjs   # browser checks, needs Playwright chromium (npx playwright install chromium)
```

## Limits

- Sound reach is user-declared. No acoustic guarantee.
- The planner is a bounded search: all orderings for up to six chores, a fixed set of shuffled orderings above that, five-minute slots. A chore marked "not placed" means this search did not find a place, not a proof that none exists.
- Times are minutes within one day. Windows that cross midnight are not supported.
- "Negotiation" means the app lays out options. It does not message or get consent from the other people.
- Free hosting: sleeps after inactivity, cold start can take over 50 seconds, data can reset.
- Not production authentication. Sessions use a random HttpOnly cookie, expire after 7 days and are cleaned up on start.

## Friction log (building for Alexa+)

- The $150 AWS credit codes had run out by the time I looked, so I built without AWS and hosted for free.
- The MCP Toolkit docs say it is available in the United States, so I could not test against a real Alexa+ device from here. I built a simulation and a plain JSON-RPC endpoint instead.
- I could not confirm a way to try an Alexa+ add-on locally without an account, so tool-call behaviour is tested only against my own client.

## Product feedback

- A downloadable local MCP test harness would let entrants outside the US check tool calls and rendering.
- Clear notice when credit codes are exhausted, on the page that offers them.

## Layout

- `src/planner.ts` planner and trace, `src/negotiate.ts` options, `src/mediator.ts` request mediator with the offline rule-based reader, `src/llm.ts` optional Gemini reader, `src/tools.ts` typed tools, `server/index.ts` API, sessions and `/mcp`.
- `BUILD_PLAN.md`, `DESIGN_SOURCES.md` background notes.

Official references: https://amazonappdev2026.devpost.com/rules and the Alexa+ MCP toolkit docs at https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html

No competitor code was copied.
