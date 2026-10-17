-- C-E: event metadata, dual status, revision, check-in windows.
-- Legacy status CLOSED maps explicitly to content_status=ARCHIVED + business_status=ACTIVE
-- (content closed / no new issuance; Gate still allowed when business ACTIVE). Do not invent CANCELLED.

ALTER TABLE events
  ADD COLUMN content_status text,
  ADD COLUMN business_status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN revision integer NOT NULL DEFAULT 1,
  ADD COLUMN visibility text NOT NULL DEFAULT 'UNLISTED',
  ADD COLUMN starts_at timestamptz,
  ADD COLUMN ends_at timestamptz,
  ADD COLUMN venue_name text,
  ADD COLUMN venue_address text,
  ADD COLUMN contact_email text,
  ADD COLUMN contact_phone text,
  ADD COLUMN contact_url text,
  ADD COLUMN check_in_opens_at timestamptz,
  ADD COLUMN check_in_closes_at timestamptz,
  ADD COLUMN max_tickets_per_attendee integer,
  ADD COLUMN cancel_reason text,
  ADD COLUMN cancelled_at timestamptz;

-- Explicit CLOSED → ARCHIVED (content). business stays ACTIVE.
UPDATE events
SET content_status = CASE
  WHEN status = 'CLOSED' THEN 'ARCHIVED'
  WHEN status = 'PUBLISHED' THEN 'PUBLISHED'
  ELSE 'DRAFT'
END;

UPDATE events
SET status = 'ARCHIVED'
WHERE status = 'CLOSED';

ALTER TABLE events
  ALTER COLUMN content_status SET NOT NULL,
  ALTER COLUMN content_status SET DEFAULT 'DRAFT';

-- Preserve legacy per-attendee cap of 5 for rows that predate C-E.
UPDATE events
SET max_tickets_per_attendee = 5
WHERE max_tickets_per_attendee IS NULL;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_chk;
ALTER TABLE events
  ADD CONSTRAINT events_status_chk
  CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));

ALTER TABLE events
  ADD CONSTRAINT events_content_status_chk
  CHECK (content_status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));

ALTER TABLE events
  ADD CONSTRAINT events_business_status_chk
  CHECK (business_status IN ('ACTIVE', 'CANCELLED'));

ALTER TABLE events
  ADD CONSTRAINT events_visibility_chk
  CHECK (visibility IN ('PUBLIC', 'UNLISTED'));

ALTER TABLE events
  ADD CONSTRAINT events_revision_chk CHECK (revision >= 1);

-- Keep legacy `status` writers (seed/tests) aligned with content_status.
CREATE FUNCTION events_mirror_content_status() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.content_status = 'DRAFT' AND NEW.status IS DISTINCT FROM 'DRAFT' THEN
      NEW.content_status := NEW.status;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.content_status IS NOT DISTINCT FROM OLD.content_status THEN
    NEW.content_status := NEW.status;
  ELSIF NEW.content_status IS DISTINCT FROM OLD.content_status
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    NEW.status := NEW.content_status;
  END IF;
  NEW.status := NEW.content_status;
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_mirror_content_status
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION events_mirror_content_status();

ALTER TABLE events
  ADD CONSTRAINT events_time_range_chk
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at);

ALTER TABLE events
  ADD CONSTRAINT events_redemption_window_chk
  CHECK (
    redemption_closes_at IS NULL
    OR redemption_opens_at IS NULL
    OR redemption_closes_at > redemption_opens_at
  );

ALTER TABLE events
  ADD CONSTRAINT events_check_in_window_chk
  CHECK (
    check_in_closes_at IS NULL
    OR check_in_opens_at IS NULL
    OR check_in_closes_at > check_in_opens_at
  );

ALTER TABLE events
  ADD CONSTRAINT events_max_tickets_chk
  CHECK (max_tickets_per_attendee IS NULL OR max_tickets_per_attendee > 0);

ALTER TABLE events
  ADD CONSTRAINT events_cancel_fields_chk
  CHECK (
    (business_status = 'CANCELLED' AND cancelled_at IS NOT NULL)
    OR (business_status = 'ACTIVE' AND cancelled_at IS NULL AND cancel_reason IS NULL)
  );
