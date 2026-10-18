-- H-P-AUDIT (#433): platform operators need SELECT to browse platform_audit_logs.
-- INSERT-only grant from d4_platform_m01 left list blocked under FORCE RLS.
GRANT SELECT ON platform_audit_logs TO ticket_platform_runtime;
