Make a three-page presentation explaining a database-field migration to the
engineers maintaining Juniper. Show how old and new application versions can
coexist, when reads can switch, and where rollback stops being simple.

---

Juniper is a fictional team directory. It is renaming the database column
full_name to display_name without changing the stored value or the public API.
The table has an immutable numeric primary key. There is one primary database;
all application reads and writes in this scenario use it.

The old application reads and writes only full_name. First add a nullable
display_name column. Deploy a bridge version that still reads full_name but
writes both columns in the same transaction. Old versions may coexist during
this deployment, so display_name is not yet authoritative.

After all old writers and their in-flight transactions have drained, backfill
in primary-key batches. Each batch uses a database UPDATE to copy the current
full_name into display_name where they differ, including null differences.
Updates lock the affected rows; no values are read into application memory
and written back later. Bridge writes continue during the backfill.

Switch reads to display_name only after the backfill finishes and a full-table
comparison finds zero differences. Keep dual writes during the read switch
and a seven-day observation period.

---

Before cleanup, a read-switch rollback uses the bridge version. Returning to
the original old writer would require repeating writer drain and reconciliation
before attempting another read switch.

After the observation period, remove full_name access from the application,
then drop the column only after no running version depends on it. Once dropped,
rolling back to those older versions requires restoring and repopulating the
column first. The seven days are a proposed policy, not proof of safety. No
database engine or measured lock duration is supplied; test DDL and batch size
on representative data before scheduling the migration.
