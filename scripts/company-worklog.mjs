#!/usr/bin/env node
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const EVENT_TYPES = ['assigned', 'checkpoint', 'interrupted', 'recovered', 'handoff', 'reviewed', 'settled', 'released'];
export function roster() {
  return JSON.parse(readFileSync(resolve(ROOT, 'company/employees.json'), 'utf8'));
}
export function employee(id) {
  const person = roster().employees.find(p => p.id === id);
  if (!person) throw Error('unknown_employee');
  return person;
}
export function validateAssignment(id, role, title) {
  const person = employee(id);
  if (!person.roles.includes(role)) throw Error('employee_role_mismatch');
  if (!title?.startsWith(`${person.name} · `)) throw Error('employee_title_mismatch');
  return person;
}
export function events(path = process.env.COMPANY_WORKLOG_FILE || resolve(ROOT, 'company/work-events.jsonl')) {
  try { return readFileSync(path, 'utf8').split('\n').filter(Boolean).map(JSON.parse); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function timestamp(value) {
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  const parsed = Date.parse(utc);
  if (Number.isNaN(parsed)) throw Error('invalid_event_timestamp');
  return new Date(parsed).toISOString();
}
export function validateEvent(event) {
  employee(event.employeeId);
  if (event.schemaVersion !== 1 || !EVENT_TYPES.includes(event.type)) throw Error('invalid_event_type');
  for (const key of ['id','runId','taskId','dispatchId','source']) if (typeof event[key] !== 'string' || !event[key]) throw Error('event_identity_required');
  if (typeof event.summary !== 'string' || !event.summary || event.summary.length > 1500) throw Error('invalid_event_summary');
  for (const key of ['occurredAt','recordedAt']) if (typeof event[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(event[key]) || Number.isNaN(Date.parse(event[key]))) throw Error('invalid_event_timestamp');
  if (!Array.isArray(event.evidence) || event.evidence.some(p => typeof p !== 'string')) throw Error('invalid_event_evidence');
  for (const key of ['issue','pr']) if (event[key] !== null && !Number.isInteger(event[key])) throw Error('invalid_event_reference');
  if (event.model !== null && (typeof event.model !== 'object' || Array.isArray(event.model))) throw Error('invalid_event_model');
  return event;
}
export function validateJournal(all) {
  const ids = new Set(), owners = new Map();
  for (const event of all) {
    validateEvent(event);
    if (ids.has(event.id)) throw Error('invalid_worklog');
    ids.add(event.id);
    const owner = owners.get(event.dispatchId);
    if (owner && ['employeeId','runId','taskId'].some(key => owner[key] !== event[key])) throw Error('dispatch_identity_conflict');
    owners.set(event.dispatchId, event);
  }
  // Check both directions so historical imports cannot hide a conflicting
  // recovery merely by appending the previous dispatch later.
  for (const event of all) {
    const previous = owners.get(event.previousDispatchId);
    if (previous && ['employeeId','runId','taskId'].some(key => previous[key] !== event[key])) throw Error('recovery_identity_conflict');
  }
  return all;
}
export function appendEvent(input, path = process.env.COMPANY_WORKLOG_FILE || resolve(ROOT, 'company/work-events.jsonl')) {
  employee(input.employeeId);
  if (!EVENT_TYPES.includes(input.type)) throw Error('invalid_event_type');
  if (!input.runId || !input.taskId || !input.dispatchId) throw Error('event_identity_required');
  if (!input.summary || typeof input.summary !== 'string' || input.summary.length > 1500) throw Error('invalid_event_summary');
  const event = {
    schemaVersion: 1,
    // Lifecycle receipts are singletons; checkpoints/handoffs/reviews can
    // legitimately occur many times. Pass the returned ID to retry one event.
    id: input.id || (['checkpoint','handoff','reviewed'].includes(input.type) ? randomUUID() : createHash('sha256').update(`${input.dispatchId}:${input.type}`).digest('hex').slice(0, 24)),
    occurredAt: timestamp(input.occurredAt || new Date().toISOString()),
    recordedAt: new Date().toISOString(),
    employeeId: input.employeeId, type: input.type,
    runId: input.runId, taskId: input.taskId, dispatchId: input.dispatchId,
    previousDispatchId: input.previousDispatchId || null,
    roleId: input.roleId || null, issue: input.issue || null, pr: input.pr || null,
    summary: input.summary, outcome: input.outcome || null,
    model: input.model || null, sha: input.sha || null,
    evidence: input.evidence || [], source: input.source || 'coordinator',
  };
  validateEvent(event);
  const all = validateJournal(events(path));
  const existing = all.find(e => e.id === event.id);
  if (existing && ['employeeId','runId','taskId','dispatchId','type','summary','outcome','sha'].some(key => existing[key] !== event[key])) throw Error('event_identity_conflict');
  if (existing) return { recorded: false, event: existing };
  validateJournal([...all, event]);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o644 });
  return { recorded: true, event };
}

function main(args) {
  const [command, ...rest] = args;
  if (command === 'roster') return roster();
  if (command === 'profile') return employee(rest[0]);
  if (command === 'record') return appendEvent(JSON.parse(readFileSync(rest[0], 'utf8')));
  if (command === 'validate') {
    const all = validateJournal(events());
    const people = roster().employees;
    if (new Set(people.map(p => p.id)).size !== people.length || new Set(people.map(p => p.name)).size !== people.length) throw Error('duplicate_employee');
    return { ok: true, employees: roster().employees.length, events: all.length };
  }
  if (command === 'status') {
    const latest = new Map();
    for (const e of events()) latest.set(e.dispatchId, e);
    return [...latest.values()].map(e => ({ employeeId: e.employeeId, dispatchId: e.dispatchId, taskId: e.taskId, type: e.type, outcome: e.outcome, occurredAt: e.occurredAt }));
  }
  throw Error('usage: company-worklog roster | profile <employee-id> | status | validate | record <event.json>');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (e) { console.error(JSON.stringify({ ok: false, errorCode: e.message })); process.exitCode = 1; }
}
