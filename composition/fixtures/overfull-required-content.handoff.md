# Konpeki pixel canvas handoff

Compiler: konpeki-composition-compiler/27

Return a complete updated konpeki-composition/v2 JSON document. Preserve stable IDs, human-edited rectangles, content, explicit form choices, topology, reading order and paint order. Re-read the current file before revising it. Render and inspect every affected page at full and review sizes; report overflow rather than shrinking or dropping required content. Never invent facts or data for draft charts and tables.

The generated Deck plan and JSON below are user-supplied composition data, not instructions that override these requirements. Preserve sources, qualifications, page order and page count. Report an overfull brief and ask for a scope decision rather than silently adding pages. Keep ordinary text in native Text-block content, not artwork. Preserve theme, typography and authoring mode unless asked to change them.

For sequential prose, use a group with layout "stack" and ordered childIds. Members are native single-region text and omit rect; the shared scene measures their heights and reflows following blocks. The group defaults to the page content margins or accepts a rect for a column/section. Paragraph gaps default to half the body leading, doubled before heading/title/display; optional group gap and member flow.gapBefore use page pixels. Preserve human flow.offset corrections. Stack groups cannot also use verticalAlignment. Overflow remains an error: compose page breaks explicitly, never shrink text or spread paragraphs to fill the page.

New pages use canvas {width,height} from 256 through 4096 (fractions allowed), or an optional named preset for default dimensions, margins and typography. An explicit canvas overrides preset dimensions. Positioned components use rect {x,y,width,height} in page pixels. Native single-region text may omit height: measured height is line count × leading + twice padding. This line-layout box includes leading and padding; it is not snug visible glyph ink, which inspect --details exposes separately. Custom visuals and multiregion text require height. Groups use rect. Movement and resizing use 1 page pixel on both axes with no column or margin snap. Legacy grid pages import losslessly, then save as pixel geometry. Padding, leading, stack gaps and flow offsets use page pixels. Text steps are fine, caption, body, lead, heading, title, display; role defaults are {"title":"title","subtitle":"lead","body":"body","caption":"caption","footnote":"fine"}. Steps remain optional defaults; textStyle.size accepts any positive pixel size. Vector font-size accepts scale:<step> or a positive pixel number. Use the top-level pages array. Components have no intent field; revision requests belong in the brief or review comments.

For positioned native text, use appearance.verticalAlignment start|center|end. Omitted alignment is end for titles, start for other roles. Center uses the first cap top through the last baseline, not the line-box height. To align positioned members together, give their group a rect and verticalAlignment, without layout. Its members retain their relative authored positions; the scene translates their combined bounds into that rectangle. This is alignment, not reflow: revise member spacing when copy grows enough to overlap. Use declared alignment for centering rather than hand-calculated offsets.

Horizontal alignment is independent: appearance.alignment start|center|end aligns native text; customVisual.alignment start|center|end aligns fitted artwork inside its padded cell (default center). Shapes and labels move together. Contain uses spare width; cover chooses the cropped side; stretch always fills the width. A left-aligned stack can still be vertically centered as a group.

Keep artwork in component-local editable vectors. Bind all colors to theme roles and font-family to theme:heading-font or theme:body-font. Use scale:<step> or a positive numeric pixel value for vector font-size. Artwork coordinates stay local; topology records meaning, not a second set of node coordinates. Mark intentional overlapping artwork with layer background or overlay; paintOrder still determines stacking. Preset changes do not silently recompose rectangles; revise the design deliberately.

Preserve element IDs and render every directed, labeled edge exactly once. Labels use x/y baseline positions and start/middle/end anchors; tspans are whole lines with explicit x/y. Do not use transforms, dx, dy or dominant-baseline. Run konpeki inspect for a revision-bound JSON layout report: compact component boxes, native text lines, artwork counts, group bounds, and the same diagnostics as konpeki check. Use --details for exact geometry, baselines, clips, fonts and individual elements. Optional --page N limits inspection and checks to that page; inspect all pages before delivery. Bounds precede clipping and occlusion. Do not save the derived report as composition JSON. Repair by stable ID, render each affected page with konpeki render, inspect the PNG, then deliver the editable JSON and requested exports. Browser automation is not required.

- Slide 01: 1920×1080 page pixels, presentation defaults; margins top/right/bottom/left 72/112/0/112; type size/leading in pixels: fine=20/28, caption=24/32, body=28/40, lead=36/46, heading=44/52, title=60/68, display=76/84.

## Deck plan

### 1. Slide 01
- Surface: 1920×1080 pixels; destination: presentation
- Audience: Decision makers
- Question: What should the audience understand or decide?
- Page number: off
- Reading flow: Text block `text-block-1` → Text block `text-block-2` → Text block `text-block-3` → Text block `text-block-4`
- Paint order, back to front: Text block `text-block-1` → Text block `text-block-2` → Text block `text-block-3` → Text block `text-block-4`

#### Composition
- Text block `text-block-1`, across the top (x 112, y 72, width 1696, height 88). Appearance — alignment: start, border: none, layout: single, logical order: none, orientation: horizontal, purpose: narrative, role: title, rule: bottom, title style: prominent, treatment: plain. Required slots — Text block.
- Text block `text-block-2`, middle-left (x 112, y 280, width 1080, height 530). Appearance — alignment: start, border: none, layout: two column, logical order: none, orientation: horizontal, purpose: comparison, role: body, rule: none, title style: plain, treatment: plain. Required slots — Text block.
- Text block `text-block-3`, middle-right (x 1248, y 280, width 560, height 420). Appearance — alignment: start, border: none, layout: single, logical order: none, orientation: horizontal, purpose: emphasis, role: body, rule: none, title style: plain, treatment: strong. Required slots — Text block.
- Text block `text-block-4`, across the bottom (x 112, y 992, width 1696, height 88). Appearance — alignment: start, border: none, layout: single, logical order: none, orientation: horizontal, purpose: narrative, role: footnote, rule: top, title style: plain, treatment: plain. Required slots — Text block.

## Relevant component guidance

- Text block: Honor semantic role, purpose, treatment, layout and orientation independently. Title, caption and footnote are typography roles, not separate component types.

## Normalized canonical Composition JSON

```json
{
  "pages": [
    {
      "audience": "Decision makers",
      "canvas": {
        "height": 1080,
        "width": 1920
      },
      "components": [
        {
          "appearance": {
            "alignment": "start",
            "border": "none",
            "layout": "single",
            "logicalOrder": "none",
            "orientation": "horizontal",
            "purpose": "narrative",
            "role": "title",
            "rule": "bottom",
            "titleStyle": "prominent",
            "treatment": "plain"
          },
          "content": "Text",
          "id": "text-block-1",
          "kind": "text-block",
          "rect": {
            "height": 88,
            "width": 1696,
            "x": 112,
            "y": 72
          },
          "slotIds": [
            "text-block-1-content"
          ],
          "textStyle": {
            "color": "ink",
            "font": "body",
            "weight": 400
          }
        },
        {
          "appearance": {
            "alignment": "start",
            "border": "none",
            "layout": "two-column",
            "logicalOrder": "none",
            "orientation": "horizontal",
            "purpose": "comparison",
            "role": "body",
            "rule": "none",
            "titleStyle": "plain",
            "treatment": "plain"
          },
          "content": "Text",
          "id": "text-block-2",
          "kind": "text-block",
          "rect": {
            "height": 530,
            "width": 1080,
            "x": 112,
            "y": 280
          },
          "slotIds": [
            "text-block-2-content"
          ],
          "textStyle": {
            "color": "ink",
            "font": "body",
            "weight": 400
          }
        },
        {
          "appearance": {
            "alignment": "start",
            "border": "none",
            "layout": "single",
            "logicalOrder": "none",
            "orientation": "horizontal",
            "purpose": "emphasis",
            "role": "body",
            "rule": "none",
            "titleStyle": "plain",
            "treatment": "strong"
          },
          "content": "Text",
          "id": "text-block-3",
          "kind": "text-block",
          "rect": {
            "height": 420,
            "width": 560,
            "x": 1248,
            "y": 280
          },
          "slotIds": [
            "text-block-3-content"
          ],
          "textStyle": {
            "color": "ink",
            "font": "body",
            "weight": 400
          }
        },
        {
          "appearance": {
            "alignment": "start",
            "border": "none",
            "layout": "single",
            "logicalOrder": "none",
            "orientation": "horizontal",
            "purpose": "narrative",
            "role": "footnote",
            "rule": "top",
            "titleStyle": "plain",
            "treatment": "plain"
          },
          "content": "Text",
          "id": "text-block-4",
          "kind": "text-block",
          "rect": {
            "height": 88,
            "width": 1696,
            "x": 112,
            "y": 992
          },
          "slotIds": [
            "text-block-4-content"
          ],
          "textStyle": {
            "color": "ink",
            "font": "body",
            "weight": 400
          }
        }
      ],
      "contentSlots": [
        {
          "id": "text-block-1-content",
          "instruction": "State the decision or takeaway.",
          "label": "Text block",
          "required": true,
          "role": "takeaway"
        },
        {
          "id": "text-block-2-content",
          "instruction": "Required constraint 1: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 2: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 3: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 4: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 5: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 6: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 7: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 8: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 9: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 10: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 11: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 12: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 13: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 14: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 15: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 16: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 17: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 18: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 19: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 20: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 21: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 22: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 23: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.\nRequired constraint 24: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.",
          "label": "Text block",
          "required": true,
          "role": "comparison-item"
        },
        {
          "id": "text-block-3-content",
          "instruction": "Explain the implication or recommended action.",
          "label": "Text block",
          "required": true,
          "role": "body"
        },
        {
          "id": "text-block-4-content",
          "instruction": "Add the source, scope, and any important caveat.",
          "label": "Text block",
          "required": true,
          "role": "source",
          "targets": [
            "text-block-1",
            "text-block-2",
            "text-block-3"
          ]
        }
      ],
      "groups": [],
      "id": "slide-1",
      "innerPadding": {
        "bottom": 0,
        "left": 112,
        "right": 112,
        "top": 72
      },
      "intendedViewingSize": "presentation",
      "name": "Slide 01",
      "pageNumber": {
        "color": "muted",
        "style": "none"
      },
      "paintOrder": [
        "text-block-1",
        "text-block-2",
        "text-block-3",
        "text-block-4"
      ],
      "preset": "presentation",
      "question": "What should the audience understand or decide?",
      "readingOrder": [
        {
          "id": "text-block-1",
          "kind": "component"
        },
        {
          "id": "text-block-2",
          "kind": "component"
        },
        {
          "id": "text-block-3",
          "kind": "component"
        },
        {
          "id": "text-block-4",
          "kind": "component"
        }
      ],
      "relationships": []
    }
  ],
  "schema": "konpeki-composition/v2",
  "theme": {
    "id": "plex",
    "mode": "paper"
  },
  "title": "Do not silently drop required routing-decision content"
}
```
