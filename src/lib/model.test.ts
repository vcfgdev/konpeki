import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJSON } from "../../composition/compile.ts";
import { fixtures } from "../../composition/fixtures.ts";
import { canvasPadding } from "../../composition/types.ts";
import { validateComposition } from "../../composition/validate.ts";
import {
  addComponent,
  addSlide,
  componentRemovalIssue,
  componentInstanceLabel,
  createComponent,
  duplicateComponent,
  initialDraft,
  parseCompositionJSON,
  parseStoredDraft,
  removeComponent,
  removeSlide,
  reorderPaintOrder,
  serializeDraft,
  snapRect,
  snapResizeRect,
  transformComponentRect,
} from "./model.ts";
import {
  clearStoredDraft,
  loadDraft,
  persistDraft,
  storageKey,
} from "./storage.ts";
import { exampleDraft } from "./examples.ts";
const firstSlide = (draft: ReturnType<typeof initialDraft>) => draft.slides[0];

test("Konpeki introduction is a seven-slide composition with native text and editable vectors", () => {
  const deck = exampleDraft("introducing-konpeki")!;
  assert.equal(deck.title, "Introducing Konpeki");
  assert.equal(deck.slides.length, 7);
  assert.equal(validateComposition(deck).ok, true);
  assert.deepEqual(new Set(deck.slides.flatMap((slide) => slide.components.map((c) => c.kind))),
    new Set(["text-block", "diagram", "image"]));
  assert.ok(deck.slides.every((slide) => slide.components.every((c) => c.customVisual?.format === "vector" || (c.kind === "text-block" && typeof c.content === "string"))));
  const opened = parseCompositionJSON(canonicalJSON(deck));
  assert.equal(opened.ok, true);
  if (opened.ok) assert.deepEqual(opened.document, deck);
});

test("starter geometry has independent bands and a complete source slot", () => {
  const draft = initialDraft();
  const slide = firstSlide(draft);
  assert.deepEqual(
    slide.components.map((component) => component.preferredRect.y),
    [72, 280, 280, 992],
  );
  assert.deepEqual(slide.innerPadding, canvasPadding);
  assert.ok(
    slide.components.every(
      (component) =>
        (component.appearance as { border?: string } | undefined)?.border ===
        "none",
    ),
  );
  const headline = slide.components[0];
  const footnote = slide.components[3];
  assert.equal(headline.preferredRect.height, 88);
  assert.deepEqual(
    {
      x: headline.preferredRect.x,
      width: headline.preferredRect.width,
    },
    { x: footnote.preferredRect.x, width: footnote.preferredRect.width },
  );
  assert.equal(
    (headline.appearance as { rule?: string }).rule,
    "bottom",
  );
  assert.equal(
    (footnote.appearance as { rule?: string }).rule,
    "top",
  );
  assert.equal(
    footnote.preferredRect.y + footnote.preferredRect.height,
    1080,
  );
  assert.deepEqual(slide.contentSlots.at(-1), {
    id: "text-block-4-content",
    label: "Text block",
    required: true,
    instruction: "Add the source, scope, and any important caveat.",
    role: "source",
    targets: ["text-block-1", "chart-2", "text-block-3"],
  });
  assert.equal(validateComposition(draft).ok, true);
});

test("the custom visual example is valid and opt-in", () => {
  assert.equal(exampleDraft(null), undefined);
  assert.equal(exampleDraft("unknown"), undefined);
  const draft = exampleDraft("custom-visual");
  assert.ok(draft);
  assert.equal(validateComposition(draft).ok, true);
  assert.equal(draft.slides[0].components[1].customVisual?.format, "vector");
});

test("a migrated React page is one lossless full-slide custom visual", () => {
  const draft = exampleDraft("react-page-migration");
  assert.ok(draft);
  const component = draft.slides[0].components[0];
  assert.deepEqual(component.preferredRect, {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
  });
  assert.equal(component.customVisual?.format, "vector");
  if (component.customVisual?.format !== "vector") return;
  assert.ok(component.customVisual.elements.length > 10);
  const reopened = parseCompositionJSON(canonicalJSON(draft));
  assert.equal(reopened.ok, true);
  if (!reopened.ok) return;
  assert.deepEqual(
    reopened.document.slides[0].components[0].customVisual,
    component.customVisual,
  );
});

test("slide addition creates an independent valid slide in deck order", () => {
  const original = initialDraft();
  original.title = "";
  const result = addSlide(original);
  assert.ok(result.slideId);
  assert.ok(result.draft.slides.some((slide) => slide.id === result.slideId));
  assert.deepEqual(
    result.draft.slides.map((slide) => [slide.id, slide.name]),
    [
      ["slide-1", "Slide 01"],
      ["slide-2", "Page 02"],
    ],
  );
  assert.deepEqual(result.draft.slides[1].components, []);
  assert.deepEqual(result.draft.slides[1].contentSlots, []);
  assert.deepEqual(result.draft.slides[1].readingOrder, []);
  assert.deepEqual(result.draft.slides[1].paintOrder, []);
  const changed = addComponent(result.draft, "diagram", undefined, result.slideId);
  assert.equal(
    changed.slides[0].components.some((component) => component.kind === "diagram"),
    false,
  );
  assert.equal(
    changed.slides[1].components.some((component) => component.kind === "diagram"),
    true,
  );
  changed.title = "Deck";
  assert.equal(validateComposition(changed).ok, true);

  const invalid = initialDraft();
  invalid.slides[0].components = [];
  assert.deepEqual(addSlide(invalid), { draft: invalid, slideId: "" });
});

test("slide removal preserves order and refuses to remove the final slide", () => {
  const deck = addSlide(addSlide(initialDraft()).draft).draft;
  const next = removeSlide(deck, "slide-2");
  assert.deepEqual(next.slides.map((slide) => slide.id), ["slide-1", "slide-3"]);
  assert.equal(validateComposition(next).ok, true);
  const single = initialDraft();
  assert.equal(removeSlide(single, "slide-1"), single);
});

test("move snaps moving center to asymmetric peer edge without changing size", () => {
  const result = snapRect(
    { x: 203, y: 103, width: 200, height: 94 },
    [{ x: 309, y: 400, width: 82, height: 77 }],
  );
  assert.deepEqual(result.rect, { x: 209, y: 103, width: 200, height: 94 });
  assert.deepEqual(result.guides, [{ axis: "x", value: 309 }]);
});

test("resize snaps only dragged right/bottom edges to asymmetric peer centers", () => {
  const others = [{ x: 470, y: 430, width: 86, height: 150 }];
  const result = snapResizeRect(
    { x: 211, y: 123, width: 297, height: 375 },
    others,
  );
  assert.deepEqual(result.rect, {
    x: 211,
    y: 123,
    width: 302,
    height: 382,
  });
  assert.deepEqual(result.guides, [
    { axis: "x", value: 513 },
    { axis: "y", value: 505 },
  ]);
  const centerNear = { x: 213, y: 105, width: 200, height: 90 };
  const peer = [{ x: 319, y: 400, width: 84, height: 40 }];
  assert.equal(snapRect(centerNear, peer).rect.x, 219);
  assert.equal(snapResizeRect(centerNear, []).rect.x, 213);
  assert.equal(snapResizeRect(centerNear, []).rect.width, 200);
});

test("resize snaps dragged left/top edges while preserving the opposite corner", () => {
  const result = snapResizeRect(
    { x: 307, y: 243, width: 393, height: 257 },
    [{ x: 221, y: 200, width: 79, height: 100 }],
    14,
    { left: true, top: true },
  );
  assert.deepEqual(result.rect, {
    x: 300,
    y: 250,
    width: 400,
    height: 250,
  });
  assert.equal(result.rect.x + result.rect.width, 700);
  assert.equal(result.rect.y + result.rect.height, 500);
  assert.deepEqual(result.guides, [
    { axis: "x", value: 300 },
    { axis: "y", value: 250 },
  ]);
});

test("resize clamps dragged left/top edges to minimum size and canvas bounds", () => {
  assert.deepEqual(
    snapResizeRect(
      { x: -20, y: -30, width: 620, height: 430 },
      [],
      0,
      { left: true, top: true },
    ).rect,
    { x: 0, y: 0, width: 600, height: 400 },
  );
  assert.deepEqual(
    snapResizeRect(
      { x: 700, y: 500, width: -100, height: -100 },
      [],
      0,
      { left: true, top: true },
    ).rect,
    { x: 420, y: 328, width: 180, height: 72 },
  );
});

test("leading-edge resize preserves small imported rectangles inside the canvas", () => {
  assert.deepEqual(
    snapResizeRect(
      { x: -80, y: -22, width: 180, height: 72 },
      [],
      0,
      { left: true, top: true },
    ).rect,
    { x: 0, y: 0, width: 100, height: 50 },
  );
  assert.deepEqual(
    snapResizeRect(
      { x: 10, y: 10, width: 90, height: 40 },
      [],
      0,
      { right: true, bottom: true },
    ).rect,
    { x: 10, y: 10, width: 180, height: 72 },
  );
});

test("leading-edge snapping uses the effective minimum for small rectangles", () => {
  const result = snapResizeRect(
    { x: 7, y: 8, width: 93, height: 42 },
    [],
    14,
    { left: true, top: true },
  );
  assert.deepEqual(result.rect, { x: 0, y: 0, width: 100, height: 50 });
  assert.deepEqual(result.guides, [
    { axis: "x", value: 0 },
    { axis: "y", value: 0 },
  ]);
});

test("snapping threshold is inclusive and canvas edges/centers clamp operations", () => {
  assert.equal(
    snapRect({ x: 14, y: 200, width: 100, height: 100 }, []).rect.x,
    0,
  );
  assert.equal(
    snapRect({ x: 15, y: 200, width: 130, height: 100 }, []).rect.x,
    15,
  );
  assert.deepEqual(
    snapRect({ x: 120, y: 80, width: 100, height: 100 }, []).rect,
    { x: canvasPadding.left, y: canvasPadding.top, width: 100, height: 100 },
  );
  assert.deepEqual(
    snapResizeRect({ x: 112, y: 72, width: 1900, height: 1200 }, []).rect,
    { x: 112, y: 72, width: 1808, height: 1008 },
  );
});

test("title and footnote are text roles rather than singleton component kinds", () => {
  const draft = initialDraft();
  assert.deepEqual(
    firstSlide(draft).components
      .filter((component) => component.kind === "text-block")
      .map((component) => component.appearance.role),
    ["title", "body", "footnote"],
  );
  const removed = removeComponent(draft, "text-block-1");
  assert.notEqual(removed, draft);
  assert.equal(componentRemovalIssue(draft, "text-block-1"), undefined);
  assert.equal(validateComposition(removed).ok, true);
  const restored = addComponent(removed, "text-block");
  assert.notEqual(restored, removed);
  assert.equal(firstSlide(restored).components.at(-1)?.kind, "text-block");
  assert.equal(validateComposition(restored).ok, true);
});

test("the final component can be removed to leave a valid empty slide", () => {
  const draft = initialDraft();
  const slide = firstSlide(draft);
  const visual = slide.components.find((component) => component.kind === "chart")!;
  slide.components = [visual];
  slide.contentSlots = slide.contentSlots.filter((slot) => visual.slotIds.includes(slot.id));
  slide.groups = [];
  slide.readingOrder = [{ kind: "component", id: visual.id }];
  slide.paintOrder = [visual.id];
  slide.relationships = [];
  const empty = removeComponent(draft, visual.id);
  assert.notEqual(empty, draft);
  assert.deepEqual(firstSlide(empty).components, []);
  assert.deepEqual(firstSlide(empty).readingOrder, []);
  assert.deepEqual(firstSlide(empty).paintOrder, []);
  assert.equal(validateComposition(empty).ok, true);
});

test("paint order can be reordered independently and rejects incomplete orders", () => {
  const draft = initialDraft();
  const reversed = [...firstSlide(draft).paintOrder].reverse();
  const next = reorderPaintOrder(draft, reversed);
  assert.deepEqual(firstSlide(next).paintOrder, reversed);
  assert.deepEqual(firstSlide(next).readingOrder, firstSlide(draft).readingOrder);
  assert.equal(reorderPaintOrder(next, reversed.slice(1)), next);
  assert.equal(validateComposition(next).ok, true);
});

test("page number remains a slide setting when footnote text is removed", () => {
  const draft = initialDraft();
  firstSlide(draft).pageNumber = { style: "01/02", color: "accent" };
  const next = removeComponent(draft, "text-block-4");
  assert.deepEqual(firstSlide(next).pageNumber, { style: "01/02", color: "accent" });
  assert.equal(validateComposition(next).ok, true);
});

test("addition preserves scoped sources and deletion updates structural references", () => {
  let draft = addComponent(initialDraft(), "diagram");
  const slide = firstSlide(draft);
  const diagram = slide.components.find(
    (component) => component.kind === "diagram",
  )!;
  assert.equal(slide.readingOrder[0].id, "text-block-1");
  assert.equal(slide.readingOrder.at(-2)?.id, "text-block-4");
  const source = slide.contentSlots.find((slot) => slot.role === "source")!;
  assert.ok("targets" in source && !source.targets.includes(diagram.id));
  slide.groups.push({ id: "body", childIds: ["text-block-3", diagram.id] });
  slide.readingOrder = [
    { kind: "component", id: "text-block-1" },
    { kind: "component", id: "chart-2" },
    { kind: "group", id: "body" },
    { kind: "component", id: "text-block-4" },
  ];
  slide.relationships.push({
    id: "link-8",
    kind: "flows-to",
    direction: "forward",
    from: { nodeId: "chart-2" },
    to: { nodeId: diagram.id },
  });
  const next = removeComponent(draft, diagram.id);
  const nextSlide = firstSlide(next);
  assert.deepEqual(nextSlide.relationships, []);
  assert.deepEqual(nextSlide.groups[0].childIds, ["text-block-3"]);
  assert.equal(nextSlide.paintOrder.includes(diagram.id), false);
  assert.equal(
    nextSlide.contentSlots.some((slot) => slot.id === diagram.slotIds[0]),
    false,
  );
  assert.equal(validateComposition(next).ok, true);
  assert.equal(slide.relationships.length, 1, "history input is immutable");
});

test("deletion refuses to orphan a preserved source target", () => {
  const draft = initialDraft();
  const source = firstSlide(draft).contentSlots.find((slot) => slot.role === "source")!;
  if (!("targets" in source)) throw new Error("Missing source targets");
  source.targets = ["chart-2"];
  assert.match(componentRemovalIssue(draft, "chart-2") ?? "", /only targets/);
  assert.equal(removeComponent(draft, "chart-2"), draft);
  assert.equal(validateComposition(draft).ok, true);
});

test("deletion retains slots that are shared with a surviving component", () => {
  const draft = initialDraft();
  const emphasis = firstSlide(draft).components.find((component) => component.id === "text-block-3")!;
  emphasis.slotIds.push("chart-2-content");
  assert.equal(validateComposition(draft).ok, true);
  const next = removeComponent(draft, "chart-2");
  assert.notEqual(next, draft);
  assert.ok(firstSlide(next).contentSlots.some((slot) => slot.id === "chart-2-content"));
  assert.equal(validateComposition(next).ok, true);
});

test("duplicate creates fresh component and slot identities with remapped topology", () => {
  const draft = structuredClone(fixtures["branching-process-return"]);
  const source = draft.slides[0].components.find(
    (component) => component.kind === "diagram",
  )!;
  const next = duplicateComponent(draft, source.id);
  const copy = next.slides[0].components.find(
    (component) => component.id !== source.id && component.kind === "diagram",
  )!;
  assert.notDeepEqual(copy.slotIds, source.slotIds);
  assert.notDeepEqual(copy.preferredRect, source.preferredRect);
  if (copy.kind !== "diagram" || !copy.topology)
    throw new Error("Duplicated topology missing");
  if (source.kind !== "diagram" || !source.topology)
    throw new Error("Source topology missing");
  source.topology.nodes[0].preferredRect = { x: 160, y: 320, width: 120, height: 80 };
  const withGeometry = duplicateComponent(draft, source.id);
  const geometryCopy = withGeometry.slides[0].components.find(
    (component) => component.id !== source.id && component.kind === "diagram",
  );
  if (geometryCopy?.kind !== "diagram" || !geometryCopy.topology)
    throw new Error("Duplicated topology geometry missing");
  assert.deepEqual(geometryCopy.topology.nodes[0].preferredRect, {
    x: 208,
    y: 368,
    width: 120,
    height: 80,
  });
  assert.deepEqual(
    copy.topology.nodes.map((node) => node.slotId),
    copy.slotIds,
  );
  assert.equal(validateComposition(next).ok, true);
  assert.equal(validateComposition(draft).ok, true);
});

test("moving and resizing a diagram transforms its explicit node geometry", () => {
  const source = structuredClone(fixtures["branching-process-return"])
    .slides[0].components.find((component) => component.kind === "diagram")!;
  if (source.kind !== "diagram" || !source.topology)
    throw new Error("Topology missing");
  source.preferredRect = { x: 100, y: 200, width: 800, height: 400 };
  source.topology.nodes[0].preferredRect = {
    x: 180,
    y: 240,
    width: 160,
    height: 80,
  };
  const transformed = transformComponentRect(
    source,
    source.preferredRect,
    { x: 300, y: 100, width: 400, height: 800 },
  );
  if (transformed.kind !== "diagram" || !transformed.topology)
    throw new Error("Transformed topology missing");
  assert.deepEqual(transformed.topology.nodes[0].preferredRect, {
    x: 340,
    y: 180,
    width: 80,
    height: 160,
  });
  assert.deepEqual(source.topology.nodes[0].preferredRect, {
    x: 180,
    y: 240,
    width: 160,
    height: 80,
  });
});

test("duplicate placement and labels distinguish repeated components", () => {
  const next = duplicateComponent(initialDraft(), "chart-2");
  const visuals = firstSlide(next).components.filter(
    (component) => component.kind === "chart",
  );
  assert.deepEqual(visuals[1].preferredRect, {
    x: 160,
    y: 328,
    width: 1080,
    height: 530,
  });
  assert.deepEqual(
    visuals.map((component) =>
      componentInstanceLabel(firstSlide(next).components, component.id),
    ),
    ["Chart 1", "Chart 2"],
  );
});

test("repeated additions offset from the latest component", () => {
  const first = addComponent(initialDraft(), "text-block");
  const second = addComponent(first, "text-block");
  const blocks = firstSlide(second).components.filter(
    (component) =>
      component.kind === "text-block" && component.appearance.role === "body",
  );
  assert.deepEqual(
    blocks.map((component) => component.preferredRect),
    [
      { x: 1248, y: 280, width: 560, height: 420 },
      { x: 1296, y: 328, width: 560, height: 420 },
      { x: 1344, y: 376, width: 560, height: 420 },
    ],
  );
  assert.equal(validateComposition(second).ok, true);
});

test("duplicating a grouped component preserves group-based reading order", () => {
  const draft = initialDraft();
  const slide = firstSlide(draft);
  slide.groups = [
    { id: "body", childIds: ["chart-2", "text-block-3"] },
  ];
  slide.readingOrder = [
    { kind: "component", id: "text-block-1" },
    { kind: "group", id: "body" },
    { kind: "component", id: "text-block-4" },
  ];
  const next = duplicateComponent(draft, "text-block-3");
  assert.deepEqual(firstSlide(next).groups[0].childIds, [
    "chart-2",
    "text-block-3",
    "text-block-3-copy",
  ]);
  assert.deepEqual(firstSlide(next).readingOrder, slide.readingOrder);
  assert.equal(validateComposition(next).ok, true);
});

test("duplicating a grouped component preserves direct reading-order representation", () => {
  const draft = initialDraft();
  firstSlide(draft).groups = [
    { id: "body", childIds: ["chart-2", "text-block-3"] },
  ];
  const next = duplicateComponent(draft, "text-block-3");
  assert.notEqual(next, draft);
  assert.deepEqual(
    firstSlide(next).readingOrder.map((entry) => entry.id),
    ["text-block-1", "chart-2", "text-block-3", "text-block-3-copy", "text-block-4"],
  );
  assert.equal(validateComposition(next).ok, true);
});

test("composition JSON import/export is canonical and lossless", () => {
  const document = addSlide(
    structuredClone(fixtures["architecture-ownership"]),
  ).draft;
  document.slides[1].name = "Decision";
  document.slides[0].components[1].customVisual = {
    format: "svg",
    source: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><circle cx="160" cy="90" r="72"/></svg>',
    viewBox: { x: 0, y: 0, width: 320, height: 180 },
    description: "A custom circular decision visual.",
    fit: "contain",
  };
  const raw = canonicalJSON(document);
  const parsed = parseCompositionJSON(raw);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(canonicalJSON(parsed.document), raw);
  const stored = parseStoredDraft(serializeDraft(parsed.document));
  assert.equal(stored.ok, true);
  if (stored.ok) assert.equal(canonicalJSON(stored.draft), raw);
  assert.equal(parseCompositionJSON("{broken").ok, false);
  assert.equal(parseCompositionJSON(canonicalJSON({ ...document, schema: "v2" })).ok, false);
});

test("v2 storage round trips and older storage is rejected", () => {
  const current = initialDraft();
  assert.deepEqual(parseStoredDraft(serializeDraft(current)), {
    ok: true,
    draft: current,
  });
  for (const raw of ["{broken", "null", "[]", '{"version":1}', '{"version":3}'])
    assert.deepEqual(parseStoredDraft(raw), { ok: false });
});

test("stored drafts reject missing and null titles but preserve unfinished strings", () => {
  const current = initialDraft();
  for (const title of [undefined, null]) {
    const document = { ...current, title };
    assert.deepEqual(
      parseStoredDraft(JSON.stringify({ version: 2, document })),
      { ok: false },
    );
  }
  for (const title of ["", "   "]) {
    const document = { ...current, title };
    const result = parseStoredDraft(JSON.stringify({ version: 2, document }));
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.draft.title, title);
  }
});

test("storage preserves unreadable data and rejects invalid writes", () => {
  const data = new Map<string, string>([[storageKey, "{lost"]]);
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
  try {
    assert.equal(loadDraft().storageBlocked, true);
    assert.equal(data.get(storageKey), "{lost");
    const invalid = structuredClone(initialDraft());
    firstSlide(invalid).components = [];
    assert.throws(() => persistDraft(invalid));
    assert.equal(data.get(storageKey), "{lost");
    clearStoredDraft();
    persistDraft(initialDraft());
    assert.equal(loadDraft().storageBlocked, false);
  } finally {
    if (original)
      Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
