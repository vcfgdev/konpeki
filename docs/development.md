# Development

Use the versions pinned by `mise.toml`, run commands through `mise exec --`, and
preserve `pnpm-lock.yaml`.

## Architecture

Static HTML and CSS are the only document source. `html/source.ts` validates and
revises source, `html/server.ts` exposes the authenticated preview and local
assets, and `html/browser.ts` uses Playwright for inspection and PNG/PDF export.
The React preview UI lives in `html/preview.tsx`; its small shared board,
alignment, positioning, and style modules live under `src/`.

`bin/konpeki.mjs` is the HTML-only CLI entry. `scripts/build-cli.mjs` bundles it
to `runtime/konpeki.mjs` so npm consumers can run it without TypeScript support.

## Verification

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm exec playwright install chromium
mise exec -- pnpm check
mise exec -- pnpm test
mise exec -- pnpm build
mise exec -- pnpm check:package
```

Before a release, install the generated tarball in a disposable directory and
exercise HTML validation, inspection, PNG/PDF export, and preview. Never publish,
push, deploy, or tag without explicit permission.
