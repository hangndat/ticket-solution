#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE ticket_app LOGIN NOSUPERUSER NOBYPASSRLS INHERIT PASSWORD '${TICKET_APP_PASSWORD}';
GRANT ticket_runtime TO ticket_app;

-- Platform pool (M12): separate credential, NOBYPASSRLS, non-owner.
-- Not a member of ticket_runtime — no permissive escalation to tenant DML.
CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE ticket_platform_app LOGIN NOSUPERUSER NOBYPASSRLS INHERIT PASSWORD '${TICKET_PLATFORM_APP_PASSWORD:-${TICKET_APP_PASSWORD}}';
GRANT ticket_platform_runtime TO ticket_platform_app;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE keycloak LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
CREATE DATABASE keycloak OWNER keycloak;
SQL
