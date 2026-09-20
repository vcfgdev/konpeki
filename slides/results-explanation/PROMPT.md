Make a three-page presentation explaining a search-quality evaluation to the
engineering lead at Waymark. Help them decide whether to test a reranker on
live traffic, balancing retrieval quality against latency.

---

Waymark is a fictional internal-document search tool. The evaluation compares
its baseline retrieval with the same retrieval followed by a reranker. Both
use the same document snapshot and the same 80 hand-authored queries: 50
direct lookups and 30 questions requiring several pieces of information.

A query passes when at least one reviewer-labeled relevant document appears
in the top five results. This measures retrieval, not whether a generated
answer would be correct or complete.

- Direct lookups: baseline passes 44 of 50; reranker passes 46 of 50.
- Multi-part questions: baseline passes 15 of 30; reranker passes 21 of 30.
- End-to-end median search latency: baseline 180 ms; reranker 310 ms.
- End-to-end 95th-percentile search latency: baseline 420 ms; reranker 760 ms.

These are synthetic, hand-authored results from one illustrative evaluation
pass, not an executed benchmark. Per-query outcomes, repeated timings, costs
and reviewer-agreement measurements are unavailable. Aggregate counts do not
show which individual queries improved or regressed.

---

The proposed gate for a limited live trial is at least 80% passing queries
overall and p95 latency no greater than 800 ms. Assess both conditions, show
the category-level trade-off and explain what this small offline set cannot
establish. Passing this gate would justify a limited trial, not a full rollout;
live query mix, tail latency and individual regressions still need evaluation.
