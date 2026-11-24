import { createHash, randomUUID, createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isHostedEnvironment } from '../auth/session.ts';
import { externalProvidersAreDisabled } from '../runtime/local-acceptance.ts';
import { CANONICAL_SCENARIOS } from '../rules/engine.ts';
import { DomainError } from '../validation/input.ts';
import type {
  AIAnalysisRecord,
  AssessmentRecord,
  EventsIndexRecord,
  PlayerRecord,
  ScenarioDefinition,
  ScenarioResultRecord,
  SessionRecord,
  StorageMode,
  StudyRunRecord,
  SystemLogRecord,
  TelemetryEvent,
} from '../types.ts';

export interface LogicalSheetsSnapshot {
  storage_mode: StorageMode;
  demo_banner: string | null;
  Players: PlayerRecord[];
  StudyRuns: StudyRunRecord[];
  Sessions: SessionRecord[];
  EventsIndex: EventsIndexRecord[];
  ScenarioResults: ScenarioResultRecord[];
  Assessments: AssessmentRecord[];
  AIAnalysis: AIAnalysisRecord[];
  Scenarios: ScenarioDefinition[];
  SystemLogs: SystemLogRecord[];
  Settings: Record<string, string | number | boolean>;
  DriveEventBatches: Record<string, { jsonl: string; checksum: string; created_at: string }>;
}

export interface SafeRideStorageAdapter {
  readonly mode: StorageMode;
  createParticipantAndStudyRun(player: PlayerRecord, studyRun: StudyRunRecord): Promise<{ player: PlayerRecord; studyRun: StudyRunRecord }>;
  createSession(session: SessionRecord): Promise<SessionRecord>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  getStudyRun(studyRunId: string): Promise<StudyRunRecord | null>;
  saveStudyRun(studyRun: StudyRunRecord): Promise<StudyRunRecord>;
  appendEventBatch(batchId: string, sessionId: string, events: TelemetryEvent[]): Promise<{ index: EventsIndexRecord; duplicate: boolean }>;
  getSessionEvents(sessionId: string): Promise<TelemetryEvent[]>;
  recordAttempt(result: ScenarioResultRecord): Promise<{ result: ScenarioResultRecord; duplicate: boolean }>;
  getStudyRunAttempts(studyRunId: string): Promise<ScenarioResultRecord[]>;
  recordAssessment(assessment: AssessmentRecord): Promise<AssessmentRecord>;
  recordAIAnalysis(analysis: AIAnalysisRecord): Promise<AIAnalysisRecord>;
  appendSystemLog(entry: Omit<SystemLogRecord, 'log_id' | 'created_at'>): Promise<SystemLogRecord>;
  readSheetRows(sheetName: string): Promise<string[][]>;
  getAdminOverview(): Promise<{
    storage_mode: StorageMode;
    is_demo_data: boolean;
    demo_label: string | null;
    totals: {
      participants: number;
      study_runs: number;
      sessions: number;
      attempts: number;
      pre_completed: number;
      post_completed: number;
      paired_completed: number;
      event_batches: number;
    };
    updated_at: string;
  }>;
  getSnapshot(): Promise<LogicalSheetsSnapshot>;
}

interface SnapshotStore {
  read(): Promise<LogicalSheetsSnapshot>;
  write(snapshot: LogicalSheetsSnapshot): Promise<void>;
}

function createInitialSnapshot(): LogicalSheetsSnapshot {
  return {
    storage_mode: 'LOCAL_DEMO_MOCK',
    demo_banner: 'Dữ liệu chỉ lưu tạm bộ nhớ local sandbox.',
    Players: [],
    StudyRuns: [],
    Sessions: [],
    EventsIndex: [],
    ScenarioResults: [],
    Assessments: [],
    AIAnalysis: [],
    Scenarios: CANONICAL_SCENARIOS,
    SystemLogs: [],
    Settings: {
      app_version: '2026.1-pilot',
      fail_closed_enabled: true,
      scoring_model: '2026.1-deterministic',
      offline_capable: true,
      ...(process.env.SAFERIDE_SYNTHETIC_RUN_ID ? {
        synthetic: true,
        research_evidence: false,
        simulation_run_id: process.env.SAFERIDE_SYNTHETIC_RUN_ID,
        school_source: process.env.SAFERIDE_SYNTHETIC_SCHOOL_SOURCE || 'public school names; synthetic students',
        school_disclaimer: 'Tên học sinh là dữ liệu tổng hợp; tên trường chỉ tham chiếu công khai cho kiểm thử local, không phải dữ liệu hoặc xác nhận của trường.',
      } : {}),
    },
    DriveEventBatches: {},
  };
}

class FileSnapshotStore implements SnapshotStore {
  private static readonly cache = new Map<string, LogicalSheetsSnapshot>();
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async read(): Promise<LogicalSheetsSnapshot> {
    const cached = FileSnapshotStore.cache.get(this.filePath);
    if (cached) return cached;
    if (!existsSync(this.filePath)) {
      const initial = createInitialSnapshot();
      await this.write(initial);
      return initial;
    }
    const snapshot = JSON.parse(readFileSync(this.filePath, 'utf8')) as LogicalSheetsSnapshot;
    FileSnapshotStore.cache.set(this.filePath, snapshot);
    return snapshot;
  }

  async write(snapshot: LogicalSheetsSnapshot): Promise<void> {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.next`;
    writeFileSync(temporaryPath, JSON.stringify(snapshot), 'utf8');
    renameSync(temporaryPath, this.filePath);
    FileSnapshotStore.cache.set(this.filePath, snapshot);
  }
}

export function hasVerifiedGoogleCredentials(): boolean {
  if (externalProvidersAreDisabled()) return false;
  return Boolean(
    process.env.GOOGLE_SHEETS_ID?.trim() &&
    process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() &&
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim()
  );
}

export function assertProductionStorageReady(): void {
  if (isHostedEnvironment() && !hasVerifiedGoogleCredentials()) {
    throw new DomainError(
      503,
      'GOOGLE_STORAGE_CREDENTIALS_MISSING',
      'Fail-closed in production: GOOGLE_SHEETS_ID, GOOGLE_DRIVE_FOLDER_ID, and GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 are required.',
    );
  }
}

export class LocalOnlyMockFileAdapter implements SafeRideStorageAdapter {
  readonly mode: StorageMode = 'LOCAL_DEMO_MOCK';
  private readonly store: SnapshotStore;

  constructor(customPath?: string, store?: SnapshotStore) {
    if (!store && isHostedEnvironment()) {
      throw new DomainError(503, 'MOCK_STORAGE_FORBIDDEN_IN_PROD', 'Local mock file adapter is explicitly local-only and forbidden in production.');
    }
    this.store = store || new FileSnapshotStore(
      customPath || process.env.SAFERIDE_LOCAL_MOCK_FILE || resolve(process.cwd(), '.runtime', 'logical_store.json'),
    );
  }

  private async readStore(): Promise<LogicalSheetsSnapshot> {
    return this.store.read();
  }

  private async writeStore(snapshot: LogicalSheetsSnapshot): Promise<void> {
    await this.store.write(snapshot);
  }

  async createParticipantAndStudyRun(player: PlayerRecord, studyRun: StudyRunRecord) {
    const store = await this.readStore();
    store.Players.push(player);
    store.StudyRuns.push(studyRun);
    await this.writeStore(store);
    return { player, studyRun };
  }

  async createSession(session: SessionRecord) {
    const store = await this.readStore();
    store.Sessions.push(session);
    await this.writeStore(store);
    return session;
  }

  async getSession(sessionId: string) {
    const store = await this.readStore();
    return store.Sessions.find(s => s.session_id === sessionId) ?? null;
  }

  async getStudyRun(studyRunId: string) {
    const store = await this.readStore();
    return store.StudyRuns.find(r => r.study_run_id === studyRunId) ?? null;
  }

  async saveStudyRun(studyRun: StudyRunRecord) {
    const store = await this.readStore();
    const idx = store.StudyRuns.findIndex(r => r.study_run_id === studyRun.study_run_id);
    if (idx >= 0) store.StudyRuns[idx] = studyRun;
    else store.StudyRuns.push(studyRun);
    await this.writeStore(store);
    return studyRun;
  }

  async appendEventBatch(batchId: string, sessionId: string, events: TelemetryEvent[]) {
    const store = await this.readStore();
    const existing = store.EventsIndex.find(b => b.batch_id === batchId);
    if (existing) {
      if (existing.session_id !== sessionId) throw new DomainError(409, 'BATCH_ID_CONFLICT', 'Batch ID belongs to another session');
      return { index: existing, duplicate: true };
    }
    const existingEventIds = new Set<string>();
    const sessionBatchFiles = new Set(store.EventsIndex
      .filter(index => index.session_id === sessionId)
      .map(index => index.drive_file_id));
    for (const [driveFileId, batch] of Object.entries(store.DriveEventBatches)) {
      if (!sessionBatchFiles.has(driveFileId)) continue;
      for (const line of batch.jsonl.split('\n').filter(Boolean)) {
        const parsed = JSON.parse(line) as TelemetryEvent;
        if (parsed.session_id === sessionId) existingEventIds.add(parsed.event_id);
      }
    }
    for (const ev of events) {
      if (existingEventIds.has(ev.event_id)) {
        throw new DomainError(409, 'DUPLICATE_EVENT_ID', `Event ${ev.event_id} already recorded`);
      }
    }
    const jsonl = events.map(e => JSON.stringify(e)).join('\n');
    const checksum = createHash('sha256').update(jsonl, 'utf8').digest('hex');
    const drive_file_id = `local-drive-jsonl-${batchId}`;
    const created_at = new Date().toISOString();
    const index: EventsIndexRecord = {
      batch_id: batchId,
      session_id: sessionId,
      event_count: events.length,
      first_seq: events[0].seq,
      last_seq: events[events.length - 1].seq,
      drive_file_id,
      checksum,
      created_at,
      write_status: 'COMMITTED',
      storage_mode: 'LOCAL_DEMO_MOCK',
    };
    store.DriveEventBatches[drive_file_id] = { jsonl, checksum, created_at };
    store.EventsIndex.push(index);
    await this.writeStore(store);
    return { index, duplicate: false };
  }

  async getSessionEvents(sessionId: string) {
    const store = await this.readStore();
    const batches = store.EventsIndex.filter(i => i.session_id === sessionId);
    const all: TelemetryEvent[] = [];
    for (const b of batches) {
      const file = store.DriveEventBatches[b.drive_file_id];
      if (!file) continue;
      for (const line of file.jsonl.split('\n').filter(Boolean)) {
        all.push(JSON.parse(line) as TelemetryEvent);
      }
    }
    return all.sort((a, b) => a.seq - b.seq);
  }

  async recordAttempt(result: ScenarioResultRecord) {
    const store = await this.readStore();
    const existing = store.ScenarioResults.find(r => r.attempt_id === result.attempt_id);
    if (existing) {
      if (existing.study_run_id !== result.study_run_id || existing.scenario_id !== result.scenario_id) {
        throw new DomainError(409, 'ATTEMPT_ID_CONFLICT', 'Attempt ID conflict');
      }
      return { result: existing, duplicate: true };
    }
    store.ScenarioResults.push(result);
    await this.writeStore(store);
    return { result, duplicate: false };
  }

  async getStudyRunAttempts(studyRunId: string) {
    const store = await this.readStore();
    return store.ScenarioResults.filter(r => r.study_run_id === studyRunId);
  }

  async recordAssessment(assessment: AssessmentRecord) {
    const store = await this.readStore();
    const idx = store.Assessments.findIndex(a => a.study_run_id === assessment.study_run_id && a.phase === assessment.phase);
    if (idx >= 0) store.Assessments[idx] = assessment;
    else store.Assessments.push(assessment);
    await this.writeStore(store);
    return assessment;
  }

  async recordAIAnalysis(analysis: AIAnalysisRecord) {
    const store = await this.readStore();
    store.AIAnalysis.push(analysis);
    await this.writeStore(store);
    return analysis;
  }

  async appendSystemLog(entry: Omit<SystemLogRecord, 'log_id' | 'created_at'>) {
    const store = await this.readStore();
    const record: SystemLogRecord = { ...entry, log_id: randomUUID(), created_at: new Date().toISOString() };
    store.SystemLogs.push(record);
    await this.writeStore(store);
    return record;
  }

  async getAdminOverview() {
    const store = await this.readStore();
    return {
      storage_mode: this.mode,
      is_demo_data: true,
      demo_label: 'Dữ liệu demo',
      totals: {
        participants: store.Players.length,
        study_runs: store.StudyRuns.length,
        sessions: store.Sessions.length,
        attempts: store.ScenarioResults.length,
        pre_completed: store.StudyRuns.filter(r => r.pre_completed).length,
        post_completed: store.StudyRuns.filter(r => r.post_completed).length,
        paired_completed: store.StudyRuns.filter(r => r.pre_completed && r.post_completed).length,
        event_batches: store.EventsIndex.length,
      },
      updated_at: new Date().toISOString(),
    };
  }

  async getSnapshot() {
    return this.readStore();
  }

  async readSheetRows(_sheetName: string): Promise<string[][]> {
    // Chế độ local không có Google Sheets live; trả về rỗng để UI dùng dữ liệu snapshot.
    return [];
  }
}

class GoogleServiceAccountAuth {
  private tokenCache: { token: string; exp: number } | null = null;

  async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.tokenCache && this.tokenCache.exp > now + 60) {
      return this.tokenCache.token;
    }

    const saB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || '';
    if (!saB64) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is missing');
    const sa = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));

    const b64url = (buf: Buffer) => buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const encH = b64url(Buffer.from(JSON.stringify(header)));
    const encC = b64url(Buffer.from(JSON.stringify(claim)));
    const signer = createSign('RSA-SHA256');
    signer.update(encH + '.' + encC);
    const sig = signer.sign(sa.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = encH + '.' + encC + '.' + sig;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt,
    });
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new Error('Google OAuth token fetch failed: ' + JSON.stringify(data));
    }
    this.tokenCache = { token: data.access_token, exp: now + (data.expires_in || 3600) };
    return data.access_token;
  }
}

const STATE_SHEET_NAME = '_trang_thai';
const STATE_CHUNK_SIZE = 40000;

class GoogleSheetSnapshotStore implements SnapshotStore {
  private ensured = false;

  constructor(private readonly auth: GoogleServiceAccountAuth) {}

  private async ensureStateSheet(token: string): Promise<void> {
    if (this.ensured) return;
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (!sheetId) throw new Error('GOOGLE_SHEETS_ID is missing');
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(title)`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Google Sheets metadata failed: ${res.status}`);
    const data = (await res.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
    const exists = data.sheets?.some(sheet => sheet.properties?.title === STATE_SHEET_NAME);
    if (!exists) {
      const add = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: STATE_SHEET_NAME, hidden: true } } }],
        }),
      });
      if (!add.ok) {
        const detail = await add.text();
        // Another serverless instance may have created the tab between the metadata read and this request.
        if (!detail.toLowerCase().includes('already exists')) {
          throw new Error(`Google Sheets add state tab failed: ${add.status} ${detail}`);
        }
      }
    }
    this.ensured = true;
  }

  async read(): Promise<LogicalSheetsSnapshot> {
    const token = await this.auth.getAccessToken();
    await this.ensureStateSheet(token);
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    const range = encodeURIComponent(`${STATE_SHEET_NAME}!A:B`);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?majorDimension=ROWS`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Google Sheets state read failed: ${res.status}`);
    const data = (await res.json()) as { values?: string[][] };
    const rows = data.values || [];
    if (!rows.length) {
      const initial = createInitialSnapshot();
      await this.write(initial);
      return initial;
    }
    const chunks: string[] = [];
    for (const row of rows) {
      // The writer appends a "-1" terminator after the final chunk. Rows are
      // returned in sheet order, so stop there and ignore any stale tail rows.
      if ((row[0] || '').trim() === '-1') break;
      if (row[1]) chunks.push(row[1]);
    }
    const text = chunks.join('');
    if (!text.trim()) {
      const initial = createInitialSnapshot();
      await this.write(initial);
      return initial;
    }
    return JSON.parse(text) as LogicalSheetsSnapshot;
  }

  async write(snapshot: LogicalSheetsSnapshot): Promise<void> {
    const token = await this.auth.getAccessToken();
    await this.ensureStateSheet(token);
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    const content = JSON.stringify(snapshot);
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += STATE_CHUNK_SIZE) {
      chunks.push(content.slice(i, i + STATE_CHUNK_SIZE));
    }
    const values = chunks.map((chunk, index) => [String(index), chunk]);
    // Terminator protects readers from stale chunks left by an earlier, longer snapshot.
    values.push(['-1', '']);
    const updateRange = encodeURIComponent(`${STATE_SHEET_NAME}!A1:B${values.length}`);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${updateRange}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error(`Google Sheets state write failed: ${res.status} ${await res.text()}`);
    // Best-effort cleanup of rows after the terminator.
    const tailRange = encodeURIComponent(`${STATE_SHEET_NAME}!A${values.length + 1}:B`);
    try {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tailRange}:clear`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
    } catch {
      // The terminator already prevents stale data from being read.
    }
  }
}

// Google Sheets & Drive Online Live Adapter
export class GoogleSheetsDriveLiveAdapter implements SafeRideStorageAdapter {
  readonly mode: StorageMode = 'GOOGLE';
  private readonly state: LocalOnlyMockFileAdapter;
  private readonly auth: GoogleServiceAccountAuth;

  constructor() {
    this.auth = new GoogleServiceAccountAuth();
    this.state = new LocalOnlyMockFileAdapter(
      undefined,
      new GoogleSheetSnapshotStore(this.auth),
    );
  }

  private async getAccessToken(): Promise<string> {
    return this.auth.getAccessToken();
  }

  private async appendRow(sheetName: string, rowValues: unknown[]): Promise<void> {
    try {
      const token = await this.getAccessToken();
      const sheetId = process.env.GOOGLE_SHEETS_ID;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A:Z:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      });
    } catch {
      // Non-blocking write to avoid student disruption
    }
  }

  private async updateRow(sheetName: string, rowNumber: number, rowValues: unknown[]): Promise<void> {
    try {
      const token = await this.getAccessToken();
      const sheetId = process.env.GOOGLE_SHEETS_ID;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A${rowNumber}:Z${rowNumber}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      });
    } catch {
      // Non-blocking write to avoid student disruption
    }
  }

  async readSheetRows(sheetName: string): Promise<string[][]> {
    try {
      const token = await this.getAccessToken();
      const sheetId = process.env.GOOGLE_SHEETS_ID;
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A:Z`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { values?: string[][] };
      return data.values || [];
    } catch {
      return [];
    }
  }

  async createParticipantAndStudyRun(player: PlayerRecord, studyRun: StudyRunRecord) {
    const res = await this.state.createParticipantAndStudyRun(player, studyRun);
    await this.appendRow('hoc_sinh', [
      player.participant_id,
      studyRun.study_run_id,
      player.full_name,
      player.class_name,
      player.school_name,
      player.province_city,
      player.privacy_notice_version,
      player.created_at,
    ]);
    return res;
  }

  async createSession(session: SessionRecord) {
    const res = await this.state.createSession(session);
    await this.appendRow('phien_choi', [
      session.session_id,
      session.participant_id,
      'Cơ bản',
      '3D',
      'CO_BAN',
      session.device_class,
      session.started_at,
      session.state,
    ]);
    return res;
  }

  async getSession(sessionId: string) {
    return this.state.getSession(sessionId);
  }

  async getStudyRun(studyRunId: string) {
    return this.state.getStudyRun(studyRunId);
  }

  async saveStudyRun(studyRun: StudyRunRecord) {
    return this.state.saveStudyRun(studyRun);
  }

  async appendEventBatch(batchId: string, sessionId: string, events: TelemetryEvent[]) {
    const res = await this.state.appendEventBatch(batchId, sessionId, events);
    for (const ev of events) {
      const payload = ev.payload || {};
      await this.appendRow('su_kien_hanh_vi', [
        ev.event_id,
        payload.attempt_id ?? '',
        ev.session_id,
        ev.type,
        Date.parse(ev.timestamp) || '',
        payload.speed_kmh ?? '',
        payload.distance_to_hazard_m ?? payload.distance_m ?? '',
      ]);
    }
    return res;
  }

  async getSessionEvents(sessionId: string) {
    return this.state.getSessionEvents(sessionId);
  }

  async recordAttempt(result: ScenarioResultRecord) {
    const res = await this.state.recordAttempt(result);
    const outcomeLabel = result.outcome === 'SAFE'
      ? 'ĐÚNG'
      : result.outcome === 'SUBOPTIMAL'
        ? 'TẠM ĐƯỢC'
        : result.outcome === 'HAZARDOUS'
          ? 'SAI'
          : 'KHÔNG HỢP LỆ';
    await this.appendRow('luot_xu_ly', [
      result.attempt_id,
      result.session_id,
      result.participant_id,
      result.scenario_id,
      result.phase,
      result.selected_decision,
      outcomeLabel,
      result.reaction_ms ?? '',
      result.rule_score,
      result.created_at,
    ]);
    return res;
  }

  async getStudyRunAttempts(studyRunId: string) {
    return this.state.getStudyRunAttempts(studyRunId);
  }

  async recordAssessment(assessment: AssessmentRecord) {
    const res = await this.state.recordAssessment(assessment);
    const rows = await this.readSheetRows('so_sanh_truoc_sau');
    const existingIndex = rows.findIndex((row, index) => index > 0 && row[0] === assessment.study_run_id);
    const toNumber = (value: string | undefined) => {
      if (value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const existing = existingIndex > 0 ? rows[existingIndex] : undefined;
    const preScore = assessment.phase === 'PRE' ? assessment.raw_score : toNumber(existing?.[2]);
    const postScore = assessment.phase === 'POST' ? assessment.raw_score : toNumber(existing?.[3]);
    const preReaction = assessment.phase === 'PRE' ? assessment.completion_time_ms : toNumber(existing?.[5]);
    const postReaction = assessment.phase === 'POST' ? assessment.completion_time_ms : toNumber(existing?.[6]);
    const delta = preScore !== null && postScore !== null ? postScore - preScore : '';
    const values = [
      assessment.study_run_id,
      assessment.participant_id,
      preScore ?? '',
      postScore ?? '',
      delta,
      preReaction ?? '',
      postReaction ?? '',
    ];
    if (existingIndex > 0) {
      await this.updateRow('so_sanh_truoc_sau', existingIndex + 1, values);
    } else {
      await this.appendRow('so_sanh_truoc_sau', values);
    }
    return res;
  }

  async recordAIAnalysis(analysis: AIAnalysisRecord) {
    const res = await this.state.recordAIAnalysis(analysis);
    await this.appendRow('nhat_ky_ai', [
      analysis.analysis_id,
      analysis.pseudonymous_ref,
      analysis.scenario_id,
      `${analysis.error_explanation}\n\nGợi ý: ${analysis.suggested_practice}`,
      analysis.safety_principle,
      analysis.created_at,
    ]);
    return res;
  }

  async appendSystemLog(entry: Omit<SystemLogRecord, 'log_id' | 'created_at'>) {
    return this.state.appendSystemLog(entry);
  }

  async getAdminOverview() {
    const overview = await this.state.getAdminOverview();
    return {
      ...overview,
      storage_mode: 'GOOGLE' as StorageMode,
      is_demo_data: false,
      demo_label: null,
    };
  }

  async getSnapshot() {
    const snapshot = await this.state.getSnapshot();
    return {
      ...snapshot,
      storage_mode: 'GOOGLE' as StorageMode,
      demo_banner: null,
    };
  }
}

let googleAdapter: GoogleSheetsDriveLiveAdapter | null = null;

export function getStorageAdapter(customMockPath?: string): SafeRideStorageAdapter {
  assertProductionStorageReady();
  if (hasVerifiedGoogleCredentials() && process.env.SAFERIDE_FORCE_LOCAL_MOCK !== 'true') {
    googleAdapter ??= new GoogleSheetsDriveLiveAdapter();
    return googleAdapter;
  }
  return new LocalOnlyMockFileAdapter(customMockPath);
}
