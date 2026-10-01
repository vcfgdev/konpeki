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
mise exec -- pnpm audit --prod
```

Before a release, install the generated tarball in a disposable directory and
exercise runtime discovery, starter preparation, HTML validation, inspection,
PNG/PDF export, and preview. Audit the installed package too: npm consumers can
resolve dependencies differently from the repository lockfile. Exercise the
preview's comment and copy-and-clear flow from that installation, not only a
source checkout.

## Release

1. Finish the verification above and commit the exact release candidate. Keep
   `package.json`, `plugin.json` and the skill's runtime version aligned. Describe
   breaking changes in the README's upgrade section and the release notes.
2. Obtain explicit approval before pushing or tagging. The release tag must
   exactly match the package version (`0.4.0`, not `v0.4.0`).
3. Pushing the approved tag starts **Stage package release**. It checks the code,
   installs and exercises the tarball, then stages that tarball on npm. A green
   workflow means staged, not published.
4. The maintainer reviews and approves the staged package through npm's approval
   flow. Verify the published version with `npm view konpeki@0.4.0 version` and
   smoke-test a registry installation before announcing availability.

GitHub release creation and the manual Pages deployment are separate actions;
neither is authorized by permission to push a tag. Never publish, push, deploy,
or tag without explicit permission for that action.
