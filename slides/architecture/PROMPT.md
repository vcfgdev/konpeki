Make a three-page presentation explaining Parcel Relay to engineers joining its
team. Help them follow an event from acceptance to delivery and understand why
a timeout can lead to a duplicate request.

---

Parcel Relay is a fictional webhook delivery service. A producer submits an
event with an event ID. The API saves the event and its delivery job in one
database transaction and returns Accepted after the transaction commits. If
the transaction cannot commit, the API returns an error and the event has not
been accepted.

Workers claim jobs from that database using time-limited leases, then POST the
events to customer endpoints. Each request includes the event ID. The database
holds the job queue; there is no separate message broker.

A 2xx response marks the job delivered. A timeout or 5xx schedules another
attempt, up to three attempts in total. A third unsuccessful attempt marks the
job failed for human investigation. A 4xx is terminal in this example. If a
worker crashes, another worker can claim its unfinished job after the lease
expires, even if the customer already received the earlier request.

Customers must handle repeated event IDs. Relay cannot make their side effects
atomic or guarantee exactly-once delivery.

---

Walk through this failure: evt-204 reaches the customer, which applies its
update, but the response is lost. Relay times out and retries evt-204. The
customer recognizes the event ID and skips the repeated update. That final
step depends on the customer's implementation; Relay does not enforce it.
