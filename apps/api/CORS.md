# API CORS configuration

Set `API_CORS_ORIGINS` to a comma-separated list of canonical HTTP(S) origins,
including the port where applicable. An unset or empty value grants no origin;
malformed entries stop API startup. Wildcards, paths and credentials in origin
URLs are rejected. Configure only the product or local origins required by the
deployment. CORS does not grant authorization and credentialed CORS is disabled.
