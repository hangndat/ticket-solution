-- W1: owner wallet aggregate — cross-tenant SELECT for verified app.actor_id only.
-- Mutations remain tickets_isolation + withTenant; no BYPASSRLS.

CREATE POLICY tickets_owner_actor_select ON tickets
  FOR SELECT
  TO ticket_runtime
  USING (
    owner_user_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );
