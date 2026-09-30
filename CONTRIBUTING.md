# Contributing to Konpeki

Bug reports and focused improvements are welcome. Search existing issues first,
and discuss large contract changes before implementing them. Never include
private documents, credentials, or proprietary source material in issues,
fixtures, or screenshots. Report vulnerabilities via [SECURITY.md](SECURITY.md).

Follow [docs/development.md](docs/development.md) for the pinned toolchain and
verification guidance. Before opening a pull request, run:

```sh
mise exec -- pnpm check
mise exec -- pnpm test
mise exec -- pnpm build
mise exec -- pnpm check:package
```

Include affected states and verification in the pull request description. UI
changes require visual inspection. Releases and deployments require maintainer
approval.

By submitting a contribution, you agree that it is licensed under the
[Apache-2.0 license](LICENSE).
