Make a four-page retrospective for the engineers and product lead who built
Dockline. Explain what they planned, what changed during the project, what
they actually delivered and what they should do differently next time.

---

Dockline is a fictional tool for requesting temporary test environments.
A four-week pilot involved two engineers and one product lead. The initial
plan was to let teams request an environment, see its status, extend its
expiry and have expired environments deleted automatically.

Week 1: the team agreed the request fields and built a form plus a status
page. Provisioning remained a manual operator task. They had not yet assigned
an owner for deletion failures or defined which environments must be retained.

Week 2: review with operators exposed two requirements: some environments
needed a retention hold, and deletion needed an audit trail. The team removed
automatic deletion from the pilot scope instead of adding it late. They kept
expiry reminders and a manual cleanup queue.

Week 3: eight invited users submitted 12 pilot requests. Nine included all
required information; three needed clarification because the form did not
explain the environment-owner field. Two users expected “submitted” to mean
“ready”, although provisioning had not finished. Those two users may also
have submitted requests needing clarification; the counts are separate.

Week 4: the form gained an owner-field explanation, and the status page
distinguished submitted, provisioning and ready. A second exercise used six
new requests: all had the required fields. It did not retest status understanding.
These are synthetic project records, not observations of a real pilot.

---

Delivered: request form, operator-updated status page, expiry reminders and
manual cleanup queue. Provisioning and deletion remain manual. Self-service
expiry extensions, retention holds, deletion audit trail and automatic deletion
are not implemented. No time-saving or reliability measurements are available.

The team's proposed lesson is to involve operators and define lifecycle
ownership before committing to automation. The next step is to specify retention
and audit behavior, assign a deletion-failure owner and retest status understanding.
The small second exercise suggests the form change helped; it does not establish
a lasting improvement or prove which change caused the result.
