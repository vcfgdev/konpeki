Make a four-page explanation of optimistic concurrency for junior backend
engineers who know HTTP and basic database updates. Use a worked editing
conflict to show why checking a revision and writing must be one atomic action.

Use sequence diagrams to show the two clients' saves: first the successful
atomic update and rejected stale save, then the contrasting race when checking
and writing are separate. Make the request order and stored revisions visible.

---

The fictional application Folio stores a document's title and integer revision.
Document 42 initially has title “Launch notes” and revision 7. Leena and Omar
both read that state before either saves.

Leena changes the title to “Launch checklist”. Omar changes it to “Release notes”.
With an unconditional update, Leena's save can succeed and then Omar's stale
save can replace it. The application loses Leena's title without warning.

In the revised contract, each save supplies the revision it read. The server
performs one atomic conditional update: match document ID and expected revision,
write the new title and increment the revision. It reports success only when
one row changed. Every title writer uses this contract; a revision is never reused
for this document, including after any restoration. Assume no deletion here.

Leena's request expects revision 7 and succeeds, storing “Launch checklist”
at revision 8. Omar's request also expects 7 and changes zero rows. The server
returns HTTP 409 Conflict and leaves revision 8 untouched.

After a conflict, the client fetches the current document and shows the user
both versions. It does not silently retry the stale title with revision 8.
The user decides whether to keep, revise or replace the current title; a new
save must use the newly fetched revision and can still conflict again.

---

Contrast the atomic update with a separate read-then-write check: both requests
could read revision 7, both pass the check and then overwrite one another.
The correctness comes from the database's atomic condition, not the revision
number merely appearing in the request.

This prevents silent lost updates under the stated contract. It does not merge
edits, choose the better title or make a multi-document change atomic. If a
successful response is lost, retrying with the old revision can return a
conflict even though the first save succeeded; revision checks alone do not
provide request deduplication or an exactly-once acknowledgement.
