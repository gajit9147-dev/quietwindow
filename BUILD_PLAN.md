# QuietWindow build plan

## Product boundary

Negotiated noise-conflict planning, not another general chore tracker. Use three fictional people, six tasks and a declared noise map for the first demo. Do not use real microphone recordings or make acoustic guarantees.

## Official-doc fit

| Experience | Official capability | Prototype route |
| --- | --- | --- |
| "Maya's call moved. Replan around it." | Alexa+ discovers and calls MCP tools | Simulated assistant with structured calls; not yet live AI |
| Remember household constraints | Stateful service behind tools | SQLite per-session state and revision |
| Compare alternatives visually | MCP Apps inline UI | Responsive web cards; not yet MCP Apps |
| Confirm before changing anything | Tool invocation and app interactions | Separate proposal and approval; server recomputes trusted plan |
| Explain blocked noisy chores | Context-aware workflow | Constraint checks and explicit unresolved task cards |

A real production add-on is a different route: remote Streamable HTTP, MCP 2025-11-25 or later, OAuth/PKCE and toolkit onboarding. Toolkit overview currently says United States availability. We are not promising this route from India.

The hackathon alternate route explicitly permits a simulated Alexa+ experience built with any AI or agentic tool and no mandatory MCP surface. The current deterministic scaffold is groundwork, not a finished eligible AI submission.

## Milestones and gates

1. **Done locally:** responsive UI, fictional scenarios, quiet-window changes, early/late proposals, approval, SQLite persistence and constraints. Eleven planner/tool tests, production build and browser checks. Nothing pushed.
2. **UI review:** show desktop/mobile previews. Get feedback before any push. Ordering search, plan diffs and incomplete-plan confirmation are now implemented locally; optimality remains unproven.
3. **Agentic runtime:** validate a no-paid-plan AI provider and server-side environment secret, then implement typed tool dispatch for reading state, changing a quiet window, generating plans; explicit UI approval remains outside model tools. Model text never overrides server constraints. Approval must be an explicit user action, not model inference. Provider failure must be visible; keep deterministic fallback clearly labelled.
4. **Demo quality:** test reload/state isolation, stale approval, malformed input, impossible constraints, overlapping tasks, keyboard/mobile, provider failure and recovery. Add a user-declared room configuration only after the small demo is reliable. Voice input is optional, with consent and typed fallback.
5. **Submission prep:** English description, source/setup, reproducible run path, under-three-minute public video, product feedback and accurate friction log. No invented testing claims. All publishing/sharing/final submission remains owner review work.

## Judging priorities

Official criteria are equally weighted: Tech Implementation, Design, Potential Impact, Quality of the Idea. For QuietWindow: prove constraint enforcement and real agentic orchestration; keep approval/alternatives easy; show a specific household conflict; distinguish the project from a Q&A bot or simple API wrapper. Do not claim unique or world-first. Prior art includes general chores, time windows and sensory-friendly routines.

A friction log can receive up to a 10% bonus under the rules. Record actual setup steps, expected/actual outcomes, severity, workaround and suggestion, including any documented regional or provider blockers. Do not fabricate feedback about Amazon tools we have not actually used.

## Sources checked

- https://amazonappdev2026.devpost.com/rules
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart.html
- https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-layout-and-rendering.html

Repository audience, license, collaborators and submission actions still require the owner's choice. External documentation does not authorize sharing.
