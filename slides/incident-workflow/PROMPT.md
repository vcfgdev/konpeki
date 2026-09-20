Make a three-page presentation walking a new on-call engineer through a
webhook delivery incident at Lantern. Show how the team moved from symptoms
to a supported diagnosis, mitigated the problem and checked recovery.

---

Lantern is a fictional notification service. Its API accepts events into a
durable queue, and workers deliver them to customer webhook endpoints.
Queue age measures how long the oldest pending event has been waiting.
The delivery objective is for 99% of accepted events to receive a successful
endpoint response within five minutes.

This fictional incident happened on 18 August 2026. All times are UTC.

09:00 — A worker release increased concurrent deliveries per worker from
20 to 80. Worker count and incoming event volume stayed unchanged.

09:05 — An alert fired: oldest pending event age reached six minutes.
The queue contained 18,000 events.

09:08 — The on-call engineer confirmed that API acceptance remained healthy.
Worker CPU was below 50%, but outbound requests were timing out more often.
The team considered a traffic surge, customer endpoint failures and a
worker-side connection bottleneck.

09:12 — Incoming volume matched its pre-release level. Timeouts appeared
across many unrelated customer endpoints. Worker traces showed requests
waiting for an available outbound connection. Each worker's connection pool
was still limited to 20 connections.

09:15 — The team rolled back the concurrency setting to 20. It did not purge
the queue or replay already completed jobs.

09:20 — Connection waits and timeout rates returned to their pre-release
levels. The queue still contained 24,000 events, down from a peak of 30,000.
The oldest pending event was 14 minutes old.

09:40 — Queue depth returned to its usual range of 0–500 events. The oldest
pending event was 40 seconds old.

10:10 — For the preceding 30 minutes, 99.3% of newly accepted events received
a successful endpoint response within five minutes.

---

The evidence supports a mismatch between worker concurrency and the connection
pool as the incident's cause. Recovery after rollback strengthens that
explanation, but the team has not yet reproduced the failure in a controlled test.

Separate mitigation from recovery: lower timeout rates at 09:20 did not mean
the backlog had cleared. The 10:10 result describes newly accepted events;
it does not erase the delivery-objective breach during the incident.

The follow-up work is to reproduce the mismatch under load, validate concurrency
and pool settings together before release, and add connection-wait time to the
rollout dashboard. No data loss was observed, but the team has not completed
an event-by-event delivery audit.
