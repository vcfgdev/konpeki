# Start with Konpeki

Follow the [quickstart](README.md#start-in-your-coding-agent), then give your
agent source material, an audience and a takeaway. You can leave the visual
direction open or supply your preferences; [AUTHORING.md](AUTHORING.md) defines
the two authoring modes and the review workflow.

Use the project's [authoring-visuals skill](.agents/skills/authoring-visuals/SKILL.md)
when your agent supports project skills. Otherwise ask it to read
[AGENTS.md](AGENTS.md) and [AUTHORING.md](AUTHORING.md).

```text
Use Konpeki to explain [source] to [audience].
Create [one slide / a short deck] with the takeaway [idea].
Visual direction: [no preference / brand, colors, fonts or references].
Mode: [default / dynamic; use default when omitted].
Preserve facts, sources and caveats. Save this prompt alongside the source.
Continue through implementation, rendering, inspection and repair.
Deliver editable source, reviewed images and verification limitations.
```

For staged review, add: “Stop after the outline and proposed visual direction.”

To choose by comparison, ask: “Show one representative page in default and
dynamic modes. Keep the content and explicit visual constraints fixed. Let me
choose before applying the mode to the whole deck.”

See the [deck directory guide](slides/README.md). New decks belong
in `slides/<name>/composition.json`; save the exact request and follow-ups in `PROMPT.md`
and substantial input facts in `SOURCE.md` beside it. See the
[implementation reference](README.md#implementation-reference) and
[verification](README.md#verification) before changing shared code.
