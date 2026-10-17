# Privacy Policy — Vemoki (draft)

**Product:** Vemoki (`vemoki.com`) · iOS app bundle `com.hangndat.ticket`  
**Operator:** Hang Nguyen Dat (individual Apple Developer Team `BLUA62D52G`)  
**Effective (draft):** 2026-10-17  
**Status:** Draft for hosting at `https://vemoki.com/privacy` — **not legal advice**; review before production submit.

This English draft is the source for the public page. A Vietnamese summary may be published alongside; if they conflict, the English page controls until counsel reviews.

---

## 1. Who we are

Vemoki is a multi-tenant event ticketing and gate check-in platform. The iOS app lets attendees view tickets and QR codes, and lets authorized staff scan tickets at the gate. Organizers configure events primarily on the web at `https://vemoki.com`.

Contact for privacy questions: `privacy@vemoki.com` (or `hangndat@gmail.com` until that alias is active).

## 2. Data we process

Depending on your role and the event configuration, we may process:

- **Account identifiers:** email address, authentication subject / user ID from our identity provider (self-hosted OpenID Connect).
- **Profile or form answers** that an event asks for when you redeem a code or are imported as a guest (may include name or phone if the organizer’s form requires them).
- **Tickets and check-in records:** ticket identifiers, status, display QR payloads, gate scan results, and related audit metadata.
- **Device push token:** Apple Push Notification service device token when you enable notifications, so we can send ticket-delivery or event-related notices.
- **Technical logs:** IP address, user-agent, timestamps, and error logs on our self-hosted infrastructure, used to operate and secure the service.

We do **not** sell personal data. The MVP does not include third-party advertising SDKs or cross-app tracking for advertising.

## 3. How we use data

- Authenticate you and enforce role-based access (attendee vs staff permissions granted by an organization).
- Issue, display, and validate tickets; confirm check-in online.
- Send transactional messages (email and, if enabled, push).
- Secure the platform (fraud/abuse prevention, audit, incident response).
- Honor account-deletion **requests** as described below.

## 4. Camera and notifications

- **Camera:** used on-device to scan ticket QR codes at the gate for authorized staff. We do not require saving photos to your library for standard scan.
- **Notifications:** optional; used for ticket delivery updates and event reminders. You can disable notifications in iOS Settings.

## 5. Sharing

We process data on infrastructure we operate (or that a hosting provider operates on our behalf under contract). Organization (tenant) admins and assigned staff see guest/ticket data needed for their event—not other tenants’ data. We may disclose information if required by law or to protect rights, safety, and security.

We do not use Expo Push or other consumer push SaaS for production delivery; push uses Apple APNs with tokens stored in our systems.

## 6. Retention

Retention for tickets, audit logs, and identity is governed by operational and legal needs and by policies still being finalized for the pilot (including regional/retention choices). We will not claim a fixed erasure SLA until that policy is closed.

## 7. Account deletion requests

In the iOS app: **Account → request account deletion** (wording may be localized). That creates a **request** acknowledged by our API. Acknowledgement is **not** immediate erasure of tickets, audit trails, or identity while deletion policy (including legal holds) remains unresolved. We will communicate status of the request through the product or email contact above.

## 8. Children

Vemoki is not directed at children under 13. Do not use the service if you are under the age required by your jurisdiction without appropriate consent.

## 9. International processing

Servers may be located in the region chosen for the deployment you use (pilot deployments are documented operationally). By using the service you understand data may be processed in that hosting region.

## 10. Changes

We may update this policy and will post the new version at `https://vemoki.com/privacy` with an updated effective date.

## 11. App Store privacy summary

A machine-readable summary of categories collected by the iOS app is maintained for App Store Connect Nutrition Labels in the project docs (`docs/asc/privacy-nutrition.md`). The public URL above is the canonical human-readable policy.
