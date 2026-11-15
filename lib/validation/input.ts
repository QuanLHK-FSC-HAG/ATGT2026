import type { ParticipantInput, TelemetryEvent } from '../types.ts';
import { isHostedEnvironment } from '../auth/session.ts';

export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError(400, 'INVALID_BODY', 'Expected an object');
  return value as Record<string, unknown>;
}

export function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value)) throw new DomainError(400, 'INVALID_ID', `Invalid ${field}`);
  return value.toLowerCase();
}

export function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string' || /[<>\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw new DomainError(400, 'INVALID_FIELD', `Invalid ${field}`);
  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (Array.from(normalized).length < min || Array.from(normalized).length > max) throw new DomainError(400, 'INVALID_FIELD', `Invalid ${field}`);
  return normalized;
}

export function noUnexpectedKeys(input: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(input).some(key => !keys.includes(key))) throw new DomainError(400, 'UNEXPECTED_FIELD', 'Unexpected field');
}

export function participantInput(value: unknown): ParticipantInput {
  const input = object(value);
  noUnexpectedKeys(input, ['full_name', 'class_name', 'school_name', 'province_city', 'privacy_notice_accepted', 'privacy_notice_version']);
  if (input.privacy_notice_accepted !== true) throw new DomainError(400, 'PRIVACY_NOTICE_REQUIRED', 'Privacy notice acknowledgement required');
  const expected = process.env.PRIVACY_NOTICE_VERSION || (!isHostedEnvironment() ? '2026-01' : '');
  if (!expected) throw new DomainError(503, 'PRIVACY_CONFIG_MISSING', 'Privacy notice is not configured');
  if ((input.privacy_notice_version ?? (!isHostedEnvironment() ? expected : '')) !== expected) throw new DomainError(400, 'PRIVACY_NOTICE_OUTDATED', 'Privacy notice version mismatch');
  const province = text(input.province_city, 'province_city', 2, 100);
  const catalog = (process.env.PROVINCE_CATALOG || '').split('|').map(item => item.trim()).filter(Boolean);
  if (isHostedEnvironment() && (!process.env.PROVINCE_CATALOG_VERSION || !catalog.length)) throw new DomainError(503, 'PROVINCE_CATALOG_MISSING', 'Verified province catalog is not configured');
  const matched = catalog.find(item => item.normalize('NFC').toLocaleLowerCase('vi') === province.toLocaleLowerCase('vi'));
  if (catalog.length && !matched) throw new DomainError(400, 'INVALID_PROVINCE', 'Province is not in the configured catalog');
  return {
    full_name: text(input.full_name, 'full_name', 2, 100),
    class_name: text(input.class_name, 'class_name', 1, 40),
    school_name: text(input.school_name, 'school_name', 2, 160),
    province_city: matched || province,
    privacy_notice_accepted: true,
    privacy_notice_version: expected,
  };
}

export function eventBatch(value: unknown, sessionId: string): { batch_id: string; events: TelemetryEvent[] } {
  const input = object(value);
  noUnexpectedKeys(input, ['batch_id', 'session_id', 'events']);
  const batchId = uuid(input.batch_id, 'batch_id');
  if (uuid(input.session_id, 'session_id') !== sessionId) throw new DomainError(403, 'SESSION_MISMATCH', 'Session mismatch');
  const maxEvents = Math.min(50, Math.max(1, Number(process.env.LOG_BATCH_MAX_EVENTS) || 50));
  if (!Array.isArray(input.events) || input.events.length < 1 || input.events.length > maxEvents) throw new DomainError(400, 'INVALID_BATCH', 'Invalid event count');
  const maxBytes = Math.min(131072, Math.max(1024, Number(process.env.LOG_BATCH_MAX_BYTES) || 131072));
  if (Buffer.byteLength(JSON.stringify(input.events), 'utf8') > maxBytes) throw new DomainError(413, 'BATCH_TOO_LARGE', 'Batch too large');
  const ids = new Set<string>();
  let previousSeq = -1;
  const events = input.events.map(raw => {
    const item = object(raw);
    noUnexpectedKeys(item, ['event_id', 'session_id', 'seq', 'timestamp', 'schema_version', 'type', 'scenario_id', 'payload']);
    const eventId = uuid(item.event_id, 'event_id');
    if (ids.has(eventId)) throw new DomainError(409, 'DUPLICATE_EVENT', 'Duplicate event');
    ids.add(eventId);
    if (uuid(item.session_id, 'session_id') !== sessionId) throw new DomainError(403, 'SESSION_MISMATCH', 'Session mismatch');
    if (!Number.isSafeInteger(item.seq) || (item.seq as number) <= previousSeq || (item.seq as number) < 1 || (item.seq as number) > 1000000) throw new DomainError(400, 'INVALID_SEQ', 'Invalid event order');
    previousSeq = item.seq as number;
    if (typeof item.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.timestamp) || !Number.isFinite(Date.parse(item.timestamp)) || Date.parse(item.timestamp) > Date.now() + 60000 || Date.parse(item.timestamp) < Date.now() - 86400000) throw new DomainError(400, 'INVALID_TIMESTAMP', 'Invalid timestamp');
    if (item.schema_version !== '1' || !['SCENARIO_START', 'HAZARD_VISIBLE', 'DECISION_INPUT', 'BRAKE', 'SIGNAL', 'PAUSE', 'RESUME', 'SCENARIO_END'].includes(String(item.type))) throw new DomainError(400, 'INVALID_EVENT', 'Unknown schema or event');
    const payload = object(item.payload);
    noUnexpectedKeys(payload, ['attempt_id', 'decision_id', 'phase', 'input_type', 'fps', 'latency_ms', 'tab_visible', 'network_online']);
    if (payload.attempt_id !== undefined) uuid(payload.attempt_id, 'attempt_id');
    if (payload.phase !== undefined && !['PRE', 'TRAINING', 'POST'].includes(String(payload.phase))) throw new DomainError(400, 'INVALID_EVENT', 'Invalid phase');
    if (payload.input_type !== undefined && !['KEYBOARD', 'TOUCH', 'MOUSE', 'UNKNOWN'].includes(String(payload.input_type))) throw new DomainError(400, 'INVALID_EVENT', 'Invalid input type');
    if (payload.decision_id !== undefined && (typeof payload.decision_id !== 'string' || !/^opt_[a-z_]{1,60}$/.test(payload.decision_id))) throw new DomainError(400, 'INVALID_EVENT', 'Invalid decision');
    for (const key of ['fps', 'latency_ms']) if (payload[key] !== undefined && (typeof payload[key] !== 'number' || !Number.isFinite(payload[key]) || (payload[key] as number) < 0 || (payload[key] as number) > 60000)) throw new DomainError(400, 'INVALID_EVENT', 'Invalid measurement');
    for (const key of ['tab_visible', 'network_online']) if (payload[key] !== undefined && typeof payload[key] !== 'boolean') throw new DomainError(400, 'INVALID_EVENT', 'Invalid boolean');
    if (typeof item.scenario_id !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(item.scenario_id)) throw new DomainError(400, 'INVALID_EVENT', 'Invalid scenario');
    return { event_id: eventId, session_id: sessionId, seq: previousSeq, timestamp: item.timestamp, schema_version: '1', type: item.type, scenario_id: item.scenario_id, payload } as TelemetryEvent;
  });
  return { batch_id: batchId, events };
}
