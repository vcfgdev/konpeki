# Security policy

## Supported versions

Konpeki is early-stage software. Security fixes are made against the latest npm
release and the `main` branch; older releases are not maintained separately.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Use GitHub's
**Security → Report a vulnerability** flow to send the maintainers a private
report. Include the affected version, reproduction steps, impact and any suggested
mitigation. Please avoid accessing data that is not yours while investigating.

The maintainers will acknowledge the report, assess its impact and coordinate a
fix and disclosure. If private vulnerability reporting is unavailable, open an
issue containing no sensitive details and ask the maintainers for a private
reporting channel.

Konpeki's file-backed preview uses a session URL as a local authorization secret.
Do not publish that URL or its token, and expose remote previews only through an
authenticated tunnel or workspace portal.
