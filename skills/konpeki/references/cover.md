# Cover or social graphic

Use for a cover, thumbnail, link preview, announcement image, or social graphic.
Apply the [shared guidance](../SKILL.md#before-authoring) and the
[authoring floor](../floor.md); this is not a miniature document.

- Use the requested destination dimensions and crop. If none are supplied for
  a general link-preview cover, start with the theme's `link` preset. Square,
  portrait, and other ratios are equally valid for their intended channels.
- Make the main subject or message recognizable at thumbnail size. Let imagery
  lead when it communicates the subject; do not require a large slogan on every
  cover. Keep supporting copy short without stripping essential qualifications.
- A deliberate headline break may improve composition. Check the actual words
  and font rather than fixing a line count or inserting breaks into every label.
- Keep essential text, faces, logos, and marks clear of the expected crop and
  platform overlays. Do not invent universal safe-area numbers; use the brief's
  placement requirements or verify the destination when placement is critical.
- Use supplied or approved imagery and preserve its meaning. Do not stretch
  images, crop away evidence, or imply an unverified product interface is real.
- For mixed compositions, use [text with visuals](patterns.md#text-with-visuals)
  to choose the image role, crop, text region, and any edge or contrast treatment.
  Do not add badges, eyebrows, metadata, or a call to action simply because other
  covers contain them.

Inspect both the full-resolution export and a reduced preview at the intended
viewing size. Verify the headline remains legible and essential details survive
the expected crop. Export PNG at the requested size; PDF is optional if requested.

## X-style post card

For an image of a post, start with
`node scripts/prepare-document.mjs <cli> <post.html> --template x-post`.
This is an editable HTML starter, not a screenshot of X or a publishing tool.
For a general announcement graphic to upload to X, use the guidance above instead.

- Replace the placeholder name, handle and post text with supplied content.
  Keep the post in paragraphs, not a headline. The author-first treatment is
  deliberate for this format; do not add a headline above or below the author.
- Set `data-appearance="light"` or `"dark"` on the page. This neutral treatment
  uses `data-theme="custom"`; layout, contrast and font checks still apply.
- The default `link` canvas is 1200×630, not an X platform requirement. Change
  `data-size` to `square` or `portrait`, or set explicit page dimensions, when
  full text and media need more room. Do not truncate, clamp or shrink text.
  For a content-sized post, choose its width, measure normal-flow content after
  fonts and images load, then write that measured height into the HTML before
  export. Keep media at its natural ratio. No fixed aspect ratio is required.
- The HTML includes commented examples for an optional avatar, one attachment,
  publication metadata, and a source link. Enable only supplied or verified
  parts, copy images beside the HTML,
  and replace their paths, descriptions and attribution. Keep meaningful media
  edges visible; the attachment uses `object-fit: contain`, not a crop or fade.
  A long post with media or attribution may need a taller canvas.
- Keep the X mark at the top right for an X source; remove or replace it for
  another platform. It identifies the platform, not author verification.
- In the footer, use the source's publication date/time and public view count
  when available. Preserve the displayed timezone or supplied offset; never
  infer one. Use a `time` element with a matching `datetime` value when known.
  Keep abbreviated or localized counts as supplied, including a known zero.
  Counts are snapshots at capture time, not live metrics. Label public X counts
  as views, not private impression analytics. Omit unknown fields, not zero-fill
  them; keep the source link even when the date or count is unavailable.
- Add paragraphs and links as ordinary HTML with stable IDs. If the author,
  handle or source is not supplied, omit it rather than inventing one. Do not
  invent engagement counts or verification badges, or imply a draft was published.
- The default fonts cover Latin text. Load appropriate licensed webfonts for
  emoji, CJK and other scripts, and set the document's `lang` correctly.
  For CJK, choose the regional Noto Sans family (SC, TC, HK, JP, or KR), rather
  than plain Noto Sans, and load every used weight.
  Successful Latin rendering does not establish glyph coverage for a new post.

Run the usual validate, inspect, render and review loop. Check both the full
image and a roughly 500px-wide preview. Choose a larger canvas or seek approval
for shorter copy if required content does not fit the requested dimensions.
