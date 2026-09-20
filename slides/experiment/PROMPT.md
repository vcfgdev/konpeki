Make a three-page presentation for the engineering team at Fieldnote explaining
an experiment with batching search-index updates. Help them weigh indexing
throughput against how long users wait for a document to become searchable,
and decide what to test next.

---

Fieldnote is a fictional document workspace. Its current indexer processes
document updates individually. The team tested batches of 20 and 100 updates
against that baseline.

Each configuration processed the same fixed set of 60,000 document updates
on the same machine, starting with an empty queue and an identical index.
An update's visibility delay runs from submission until the updated document
appears in search. Each configuration was run once.

Individual updates:
- Total processing time: 300 seconds.
- Median visibility delay: 1.2 seconds.
- 95th-percentile visibility delay: 2.4 seconds.

Batches of 20:
- Total processing time: 200 seconds.
- Median visibility delay: 1.8 seconds.
- 95th-percentile visibility delay: 4.1 seconds.

Batches of 100:
- Total processing time: 150 seconds.
- Median visibility delay: 4.9 seconds.
- 95th-percentile visibility delay: 11.8 seconds.

All configurations produced the expected final document versions, with no
missing updates in the final check. These are synthetic, hand-authored results.
There are no repeated runs, uncertainty estimates or production measurements.

---

The team's proposed acceptance criteria are at least 250 updates per second
and a 95th-percentile visibility delay no greater than 5 seconds.

Recommend which configuration deserves a follow-up test. Explain why the
fastest configuration is not necessarily the best fit. The next experiment
should repeat the runs and include both sparse arrivals and bursts, since
a fixed workload does not establish behavior under live traffic.
