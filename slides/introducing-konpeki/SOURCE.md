# Source facts

The original deck used the Konpeki 0.3.1 documentation. Its product copy was
updated for the 0.4.0 owned-scene release using the repository sources below;
the historical brief and earlier revision remain in PROMPT.md.

| Claim | Source |
| --- | --- |
| Covers, social graphics, visual explanations and presentations; PNG, SVG, PDF, JSON, Present | README.md |
| Page presets: Presentation, Square post, Portrait post, Link preview / OG, Article header | docs/workflow.md |
| Skill install `npx skills add vcfgdev/konpeki -g`; Node.js 24+, npm, agent with file/command access; browser optional | SETUP.md, README.md |
| Browser edits save atomically to the file; revision hash; agent revisions load with the previous document in Undo | docs/workflow.md |
| Five component kinds; editable vectors with stable IDs; Chart/Diagram/Table defaults are structural drafts | composition/README.md, docs/workflow.md |
| Notes and pins stay beside the file and are not exported; revisions continue in chat, with no automatic agent wake-up | docs/workflow.md, skills/konpeki/SKILL.md |
| Write, check, repair, render PNG, inspect, deliver; no browser required for the agent | skills/konpeki/SKILL.md, bin/konpeki.mjs |
| Playground: no account, local copy, no agent sync, download JSON | README.md |

The Konpeki mark is the product's own asset, copied from `slides/github-cover`.
All other drawings are original schematic artwork, not screenshots.
