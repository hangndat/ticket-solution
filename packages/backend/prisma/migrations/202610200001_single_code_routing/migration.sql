-- Single-code redemption: global routing registry (ADR single-code-redemption.md §4.1).

CREATE TABLE code_routing_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routing_key text NOT NULL,
  plaintext_fingerprint bytea,
  resolution text NOT NULL,
  routed_tenant_id uuid,
  routed_event_id uuid,
  routed_code_id uuid,
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT code_routing_groups_resolution_chk CHECK (
    resolution IN ('ROUTABLE', 'AMBIGUOUS', 'LEGACY_UNLINKED')
  ),
  CONSTRAINT code_routing_groups_routing_key_unique UNIQUE (routing_key),
  CONSTRAINT code_routing_groups_routed_fk FOREIGN KEY (routed_tenant_id, routed_code_id)
    REFERENCES redemption_codes (tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE code_routing_candidates (
  routing_group_id uuid NOT NULL REFERENCES code_routing_groups (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  redemption_code_id uuid NOT NULL,
  code_pepper_version integer NOT NULL,
  code_hmac text NOT NULL,
  code_status_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (routing_group_id, tenant_id, event_id, redemption_code_id),
  CONSTRAINT code_routing_candidates_code_unique UNIQUE (tenant_id, event_id, redemption_code_id),
  CONSTRAINT code_routing_candidates_code_fk FOREIGN KEY (tenant_id, redemption_code_id)
    REFERENCES redemption_codes (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT code_routing_candidates_status_chk CHECK (
    code_status_snapshot IN ('AVAILABLE', 'HELD', 'CONSUMED', 'DISABLED')
  )
);

CREATE TABLE code_routing_digest_aliases (
  code_pepper_version integer NOT NULL,
  code_hmac text NOT NULL,
  routing_group_id uuid NOT NULL REFERENCES code_routing_groups (id) ON DELETE RESTRICT,
  routing_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code_pepper_version, code_hmac)
);

CREATE INDEX code_routing_digest_aliases_group_idx
  ON code_routing_digest_aliases (routing_group_id);

CREATE INDEX code_routing_groups_ambiguous_idx
  ON code_routing_groups (resolution)
  WHERE resolution = 'AMBIGUOUS';

GRANT SELECT, INSERT, UPDATE ON code_routing_groups TO ticket_runtime;
GRANT SELECT, INSERT, UPDATE ON code_routing_candidates TO ticket_runtime;
GRANT SELECT, INSERT ON code_routing_digest_aliases TO ticket_runtime;
