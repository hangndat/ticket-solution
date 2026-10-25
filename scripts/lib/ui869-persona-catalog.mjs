/**
 * OIDC persona catalog for local UI869 / VCX-925 fixtures (fake data only).
 * UUIDs match packages/backend D9_DEMO (docs/demo/D9-DEMO-DATASET.md).
 */
const MFEST = 'd9d9f001-0001-4000-8000-000000000001';
const STUDIO = 'd9d9f001-0001-4000-8000-000000000002';
const MFEST_EVENT = 'd9d9f001-0002-4000-8000-000000000001';
const STUDIO_EVENT = 'd9d9f001-0002-4000-8000-000000000002';
const MFEST_SLUG = 'mfest-demo';
const STUDIO_SLUG = 'demo-studio';

/** @typedef {'Owner'|'Manager'|'CS'|'Supervisor'|'Scanner'} StaffRole */

/**
 * @typedef {object} PersonaDef
 * @property {string} id
 * @property {string} email
 * @property {string} password
 * @property {'staff'|'attendee'} kind
 * @property {StaffRole|null} role
 * @property {string[]} tenantIds
 * @property {{ tenantId: string, eventId: string, permissions?: string[] }[]} assignments
 */

export const PERSONA_PASSWORD_SUFFIX = '-fixture-demo';

export const PERSONAS = [
  {
    id: 'owner',
    email: 'owner.fixture@example.com',
    password: `owner${PERSONA_PASSWORD_SUFFIX}`,
    kind: 'staff',
    role: 'Owner',
    tenantIds: [MFEST],
    assignments: [{ tenantId: MFEST, eventId: MFEST_EVENT }],
  },
  {
    id: 'manager',
    email: 'manager.fixture@example.com',
    password: `manager${PERSONA_PASSWORD_SUFFIX}`,
    kind: 'staff',
    role: 'Manager',
    tenantIds: [MFEST],
    assignments: [{ tenantId: MFEST, eventId: MFEST_EVENT }],
  },
  {
    id: 'cs',
    email: 'cs.fixture@example.com',
    password: `cs${PERSONA_PASSWORD_SUFFIX}`,
    kind: 'staff',
    role: 'CS',
    tenantIds: [MFEST],
    assignments: [{ tenantId: MFEST, eventId: MFEST_EVENT }],
  },
  {
    id: 'supervisor',
    email: 'supervisor.fixture@example.com',
    password: `supervisor${PERSONA_PASSWORD_SUFFIX}`,
    kind: 'staff',
    role: 'Supervisor',
    tenantIds: [MFEST],
    assignments: [{ tenantId: MFEST, eventId: MFEST_EVENT }],
  },
  {
    id: 'scanner',
    email: 'scanner.fixture@example.com',
    password: `scanner${PERSONA_PASSWORD_SUFFIX}`,
    kind: 'staff',
    role: 'Scanner',
    tenantIds: [MFEST],
    assignments: [{ tenantId: MFEST, eventId: MFEST_EVENT }],
  },
  {
    id: 'report-only',
    email: 'report.fixture@example.com',
    password: `report${PERSONA_PASSWORD_SUFFIX}`,
    kind: 'staff',
    role: 'Manager',
    tenantIds: [MFEST],
    assignments: [
      {
        tenantId: MFEST,
        eventId: MFEST_EVENT,
        permissions: ['report.read'],
      },
    ],
  },
  {
    id: 'attendee',
    email: 'attendee@example.com',
    password: 'attendee-demo',
    kind: 'attendee',
    role: null,
    tenantIds: [],
    assignments: [],
  },
  {
    id: 'legacy-staff-owner',
    email: 'staff@example.com',
    password: 'staff-demo',
    kind: 'staff',
    role: 'Owner',
    tenantIds: [MFEST, STUDIO],
    assignments: [
      { tenantId: MFEST, eventId: MFEST_EVENT },
      { tenantId: STUDIO, eventId: STUDIO_EVENT },
    ],
  },
];

export const PERSONA_IDS = PERSONAS.map((p) => p.id);

export const FIXTURE_TENANTS = {
  mfest: { id: MFEST, slug: MFEST_SLUG },
  studio: { id: STUDIO, slug: STUDIO_SLUG },
  mfestEvent: MFEST_EVENT,
  studioEvent: STUDIO_EVENT,
};
