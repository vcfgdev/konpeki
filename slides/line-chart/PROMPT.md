Make a two-page briefing for the engineering lead at Tide about eight weeks
of service latency. Use a line chart to explain the trend, then explain what
the team can conclude and what it should investigate next.

Show both series on the same millisecond axis, with direct labels at their
last observations and a horizontal target line at 700 ms. Show the missing
observation as a gap rather than connecting across it or substituting zero.

---

Tide is a fictional document service. The following weekly p95 request latencies
are synthetic, hand-authored data. Each value describes that endpoint's requests
for the whole week, not an average of daily percentiles. Lower is better.

Week starting | Search p95 (ms) | Document-open p95 (ms)
1 June 2026 | 920 | 620
8 June 2026 | 860 | 610
15 June 2026 | 810 | 640
22 June 2026 | missing | 630
29 June 2026 | 740 | 650
6 July 2026 | 690 | 670
13 July 2026 | 660 | 660
20 July 2026 | 640 | 680

Search telemetry was unavailable for the week starting 22 June; its latency
is unknown. The team's weekly p95 target is at most 700 ms for each endpoint.
An index change was enabled at the start of 29 June. Mark that event without
presenting it as the cause of the trend: search was already improving before it.

---

The last three observed search weeks meet the target, and all eight observed
document-open weeks meet it. Search's first-to-last observed p95 falls from
920 to 640 ms. This does not establish continuous target compliance, individual
request latency or the effect of the index change.

Request counts, traffic mix, error rates and uncertainty estimates are unavailable.
There was no control group. Recommend restoring reliable telemetry and checking
traffic mix and errors before attributing the improvement or declaring the work
finished. Keep the distinction between observed progress and causal evidence clear.
