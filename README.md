# QuietWindow

A simulated Alexa+ household experience for negotiating noisy chores around declared quiet windows.

## Status

Local prototype only. Offline deterministic planning. No live AI, Alexa account connection, voice capture, device control, household messaging or production deployment. Scenario buttons are explicit tool invocations, not natural-language AI.

## Run

Node 22.13+ is needed for built-in SQLite (experimental in Node 22).

```
npm install
npm run server
# In another terminal:
npm run dev
```

Open the Vite URL. Fictional demo: Maya, Arun, Leo and six chores. Each browser session has its own random HttpOnly cookie and SQLite record. The database stays in ignored data/; do not commit real household records.

```
npm test
npm run build
node tests/ui-check.mjs
node tests/api-check.mjs
```

The browser verification uses local Chrome at /usr/bin/google-chrome-stable. It starts and stops its own local API and web processes.

## Assumptions and limits

All sound reach is user-declared, not measured. One person performs chores sequentially. The two proposals use an ordering search with greedy five-minute-grid slot placement (all 720 orders for the six-chore demo); unplaced tasks are not a proof that an exhaustive search cannot find a solution. A call blocking the whole afternoon does make affected noisy tasks impossible under the declared map. Quiet chores also avoid occupied rooms.

Plans are generated without saving. Approval regenerates the trusted proposal, rejects a stale revision and persists the approved state. Changing quiet windows invalidates approval. The UI discloses unresolved tasks and requires a second confirmation to save an incomplete plan; the API requires an explicit acknowledgement too.

The local cookie and localhost-only server are not production authentication. Before deployment add secure cookies, origin/auth configuration, concurrency checks, expiry/rate limiting and stronger request validation. No guarantees of acoustic quiet or health benefits.

## Hackathon route

The hackathon allows a simulated Alexa+ experience with an entrant's own AI/agentic tools. This prototype is not yet an AI experience or final submission. A later milestone must validate live AI and honest fallback, with tool-call auditing and UI review before changes are pushed.

Official references:
- https://amazonappdev2026.devpost.com/rules
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-layout-and-rendering.html

The current toolkit overview says the MCP Toolkit is available in the United States. Production Alexa onboarding is not promised. No competitor code copied.

## Free hosted demo

Render free hosting uses temporary disk. Session state survives ordinary page reloads while that service instance runs, but can reset after a restart/redeploy. Use fictional demo inputs only; there is no production household account or durable cloud-storage promise. Free hosting may sleep and need a cold start. No paid disk or service is configured.
