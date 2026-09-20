Make a two-page engineering briefing for fictional document workspace Fieldnote. Page 1 should demonstrate a vertical bar chart. Page 2 should demonstrate two vertical bar charts side by side: throughput on the left, search visibility delay on the right.

---

Each configuration processed the same 60,000 document updates on the same machine, starting with an empty queue and identical index. Individual updates took 300 seconds with a p95 visibility delay of 2.4 seconds; batches of 20 took 200 seconds with p95 delay of 4.1 seconds; batches of 100 took 150 seconds with p95 delay of 11.8 seconds. Visibility delay runs from submission until the updated document appears in search. All final document versions were correct.

These are synthetic, hand-authored results, with one run per configuration and no production measurements or uncertainty estimates.

---

Page 1 compares derived throughput: 200, 300 and 400 updates per second. Page 2 compares throughput against the proposed minimum of 250 updates per second and p95 visibility delay against the maximum of 5 seconds. Use zero-based axes, direct values and consistent category order. Each chart needs its own clearly labeled units and scale.

Recommend batches of 20 for follow-up testing, not production adoption. Explain why maximum throughput alone is insufficient. Preserve the single-run limitation and the need to repeat tests with sparse arrivals and bursts.
