# HTML authoring fixture

This two-page field guide was used to test direct HTML authoring, normal prose
reflow, and saved human corrections. The prototype host has moved into `html/`;
use the checkout CLI rather than a separate experiment server.

From the repository root, prepare the local font assets, then preview:

```sh
mise exec -- pnpm fonts:generate
mkdir -p experiments/html-preview/fonts
cp fonts/ibm-plex-sans-latin-{400,600}-normal.ttf fonts/LICENSE-ibm-plex-sans.txt experiments/html-preview/fonts/
mise exec -- node bin/konpeki.mjs preview experiments/html-preview/field-guide.html --port 4320
```

Inspection and export additionally need the explicitly installed CLI browser:

```sh
mise exec -- node bin/konpeki.mjs browser install
mise exec -- node bin/konpeki.mjs inspect experiments/html-preview/field-guide.html
mise exec -- node bin/konpeki.mjs render experiments/html-preview/field-guide.html --format pdf --output /tmp/field-guide.pdf
```

Keep the printed preview capability URL private: it permits changes to the
selected source. In an orb, use the host's supervised service and private portal.
This is a development preview, not an untrusted-document hosting service.

The source retains the `12px -6px` caption correction and `1px` heading correction.
The expanded email paragraph demonstrates prose reflow without line coordinates.
The original JSON gallery remains unchanged. See [the HTML contract](../../html/README.md)
for current limitations and [the workflow](../../docs/workflow.md) for review.
