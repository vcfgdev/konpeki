# Konpeki

Konpeki helps a coding agent turn a brief and source material into finished
visuals. Ordinary HTML and CSS are the editable source; Konpeki validates,
inspects, previews, and exports PNG or PDF.

Use it for covers, social graphics, diagrams, charts, explainers, documents, and
presentations. Start with the [Konpeki skill](skills/konpeki/SKILL.md), which owns
the authoring workflow. Supporting references are intentionally narrow:

- [HTML, files, theme, and CLI](html/README.md)
- [Theme contract](html/theme.md)
- [Taste and editorial judgment](AUTHORING.md)
- [Setup](SETUP.md)
- [Examples](examples/README.md)
- [Development](docs/development.md)

The default theme is cobalt blue on a light canvas with local IBM Plex Sans and
Mono. Its CSS contract lets a brief supply its own visual treatment. Composition
stays in HTML and page-owned CSS.

The preview supports comments and small source-backed geometry corrections.
PNG and PDF are the primary delivery artifacts; recipients do not need Konpeki,
Playwright, or Chromium to view them.

## Status and installation

Konpeki is not published to npm yet. The version
in `package.json` identifies the repository package only. Use a prepared source
checkout or install a tarball packed locally from a trusted checkout. Installing
the skill does not install the runtime. See [SETUP.md](SETUP.md).

Install the authoring skill separately:

```sh
npx skills add vcfgdev/konpeki -g
```

Try the [public comment preview](https://vcfgdev.github.io/konpeki/) or inspect
the three [example sources](examples/README.md).

Konpeki requires no account or hosted AI service. Your coding agent's pricing
and data handling still apply. Supply facts and approved assets; examples and
placeholders are not evidence about real products.

## License

[Apache-2.0](LICENSE). Bundled IBM Plex Sans and Mono files retain the SIL
Open Font Licenses in [`fonts/OFL.txt`](fonts/OFL.txt) and
[`fonts/plex-mono-OFL.txt`](fonts/plex-mono-OFL.txt).
