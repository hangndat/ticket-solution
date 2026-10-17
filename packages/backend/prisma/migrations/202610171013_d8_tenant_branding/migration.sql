-- D8-S1: tenant branding fields (display name + colors). logo_asset_id already on tenants.
-- RLS remains the existing tenants isolation policy (tenant-local via app.tenant_id).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_display_name_len_chk;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_display_name_len_chk
  CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 200);

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_primary_color_chk;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_primary_color_chk
  CHECK (
    primary_color IS NULL
    OR primary_color ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'
  );

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_secondary_color_chk;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_secondary_color_chk
  CHECK (
    secondary_color IS NULL
    OR secondary_color ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'
  );

-- Seed display_name from legal/org name for existing rows (nullable allowed for new).
UPDATE tenants
SET display_name = name
WHERE display_name IS NULL AND name IS NOT NULL;
