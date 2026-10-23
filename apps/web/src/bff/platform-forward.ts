/** Tenant-admin / me BFF uses attendee OIDC cookie (Owner MFA on ticket-web). */
export { forwardWithBearer as forwardTenantBearer } from './upstream';
