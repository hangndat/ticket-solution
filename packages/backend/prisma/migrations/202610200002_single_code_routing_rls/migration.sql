-- RLS for global code routing registry (SCR). Global groups/aliases: ticket_runtime catalog.
-- Candidates are tenant-scoped like redemption_codes.

ALTER TABLE code_routing_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_routing_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE code_routing_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_routing_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE code_routing_digest_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_routing_digest_aliases FORCE ROW LEVEL SECURITY;

CREATE POLICY code_routing_groups_global ON code_routing_groups TO ticket_runtime
  USING (true) WITH CHECK (true);
CREATE POLICY code_routing_digest_aliases_global ON code_routing_digest_aliases TO ticket_runtime
  USING (true) WITH CHECK (true);
CREATE POLICY code_routing_candidates_isolation ON code_routing_candidates TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON code_routing_groups, code_routing_candidates, code_routing_digest_aliases
  FROM PUBLIC;
