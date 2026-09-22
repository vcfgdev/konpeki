# Contributing to Konpeki

Thanks for helping improve Konpeki. Bug reports, focused fixes and additions that
strengthen the shared human-agent canvas are welcome.

## Before opening a change

- Search existing issues before filing a new one.
- Use an issue to discuss large features or changes to the composition contract
  before investing in an implementation.
- Do not include private compositions, credentials or proprietary source material
  in issues, fixtures or screenshots.
- Report security concerns through the process in [SECURITY.md](SECURITY.md), not
  through a public issue.

## Development

Follow [docs/development.md](docs/development.md) to install the pinned Node.js and
pnpm toolchain. Keep changes scoped and preserve existing composition compatibility
unless a contract change has been agreed in advance.

Before opening a pull request, run:

```sh
mise exec -- pnpm check
mise exec -- pnpm test
mise exec -- pnpm build
mise exec -- pnpm check:package
```

UI changes also require visual inspection using the relevant browser checks in
[docs/development.md](docs/development.md#verification). Include the affected
states and verification performed in the pull request description.

By submitting a contribution, you agree that it is licensed under the repository's
[Apache-2.0 license](LICENSE).
