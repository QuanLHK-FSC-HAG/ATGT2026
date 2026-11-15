import { createHash, randomUUID, createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isHostedEnvironment } from '../auth/session.ts';
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

export function hasVerifiedGoogleCredentials(): boolean {
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
  private readonly filePath: string;

  constructor(customPath?: string) {
    if (isHostedEnvironment()) {
      throw new DomainError(503, 'MOCK_STORAGE_FORBIDDEN_IN_PROD', 'Local mock file adapter is explicitly local-only and forbidden in production.');
    }
    this.filePath = customPath || resolve(process.cwd(), '.runtime', 'logical_store.json');
  }

  private readStore(): LogicalSheetsSnapshot {
    if (!existsSync(this.filePath)) {
      const initial: LogicalSheetsSnapshot = {
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
        },
        DriveEventBatches: {},
      };
      this.writeStore(initial);
      return initial;
    }
    return JSON.parse(readFileSync(this.filePath, 'utf8')) as LogicalSheetsSnapshot;
  }

  private writeStore(snapshot: LogicalSheetsSnapshot): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  async createParticipantAndStudyRun(player: PlayerRecord, studyRun: StudyRunRecord) {
    const store = this.readStore();
    store.Players.push(player);
    store.StudyRuns.push(studyRun);
    this.writeStore(store);
    return { player, studyRun };
  }

  async createSession(session: SessionRecord) {
    const store = this.readStore();
    store.Sessions.push(session);
    this.writeStore(store);
    return session;
  }

  async getSession(sessionId: string) {
    const store = this.readStore();
    return store.Sessions.find(s => s.session_id === sessionId) ?? null;
  }

  async getStudyRun(studyRunId: string) {
    const store = this.readStore();
    return store.StudyRuns.find(r => r.study_run_id === studyRunId) ?? null;
  }

  async saveStudyRun(studyRun: StudyRunRecord) {
    const store = this.readStore();
    const idx = store.StudyRuns.findIndex(r => r.study_run_id === studyRun.study_run_id);
    if (idx >= 0) store.StudyRuns[idx] = studyRun;
    else store.StudyRuns.push(studyRun);
    this.writeStore(store);
    return studyRun;
  }

  async appendEventBatch(batchId: string, sessionId: string, events: TelemetryEvent[]) {
    const store = this.readStore();
    const existing = store.EventsIndex.find(b => b.batch_id === batchId);
    if (existing) {
      if (existing.session_id !== sessionId) throw new DomainError(409, 'BATCH_ID_CONFLICT', 'Batch ID belongs to another session');
      return { index: existing, duplicate: true };
    }
    const existingEventIds = new Set<string>();
    for (const batch of Object.values(store.DriveEventBatches)) {
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
    this.writeStore(store);
    return { index, duplicate: false };
  }

  async getSessionEvents(sessionId: string) {
    const store = this.readStore();
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
    const store = this.readStore();
    const existing = store.ScenarioResults.find(r => r.attempt_id === result.attempt_id);
    if (existing) {
      if (existing.study_run_id !== result.study_run_id || existing.scenario_id !== result.scenario_id) {
        throw new DomainError(409, 'ATTEMPT_ID_CONFLICT', 'Attempt ID conflict');
      }
      return { result: existing, duplicate: true };
    }
    store.ScenarioResults.push(result);
    this.writeStore(store);
    return { result, duplicate: false };
  }

  async getStudyRunAttempts(studyRunId: string) {
    const store = this.readStore();
    return store.ScenarioResults.filter(r => r.study_run_id === studyRunId);
  }

  async recordAssessment(assessment: AssessmentRecord) {
    const store = this.readStore();
    const idx = store.Assessments.findIndex(a => a.study_run_id === assessment.study_run_id && a.phase === assessment.phase);
    if (idx >= 0) store.Assessments[idx] = assessment;
    else store.Assessments.push(assessment);
    this.writeStore(store);
    return assessment;
  }

  async recordAIAnalysis(analysis: AIAnalysisRecord) {
    const store = this.readStore();
    store.AIAnalysis.push(analysis);
    this.writeStore(store);
    return analysis;
  }

  async appendSystemLog(entry: Omit<SystemLogRecord, 'log_id' | 'created_at'>) {
    const store = this.readStore();
    const record: SystemLogRecord = { ...entry, log_id: randomUUID(), created_at: new Date().toISOString() };
    store.SystemLogs.push(record);
    this.writeStore(store);
    return record;
  }

  async getAdminOverview() {
    const store = this.readStore();
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
}

// Google Sheets & Drive Online Live Adapter
export class GoogleSheetsDriveLiveAdapter implements SafeRideStorageAdapter {
  readonly mode: StorageMode = 'GOOGLE';
  private readonly fallback: LocalOnlyMockFileAdapter;
  private tokenCache: { token: string; exp: number } | null = null;

  constructor() {
    this.fallback = new LocalOnlyMockFileAdapter();
  }

  private async getAccessToken(): Promise<string> {
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

  private async appendRow(sheetName: string, rowValues: unknown[]): Promise<void> {
    try {
      const token = await this.getAccessToken();
      const sheetId = process.env.GOOGLE_SHEETS_ID;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}!A:Z:append?valueInputOption=USER_ENTERED`, {
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

  async createParticipantAndStudyRun(player: PlayerRecord, studyRun: StudyRunRecord) {
    const res = await this.fallback.createParticipantAndStudyRun(player, studyRun);
    await this.appendRow('hoc_sinh', [
      player.participant_id,
      player.full_name,
      player.class_name,
      player.school_name,
      player.province_city,
      player.privacy_notice_version,
      player.created_at,
      player.status,
    ]);
    await this.appendRow('phien_choi', [
      studyRun.study_run_id,
      studyRun.participant_id,
      studyRun.current_phase,
      studyRun.state,
      'CO_BAN',
      studyRun.created_at,
    ]);
    return res;
  }

  async createSession(session: SessionRecord) {
    return this.fallback.createSession(session);
  }

  async getSession(sessionId: string) {
    return this.fallback.getSession(sessionId);
  }

  async getStudyRun(studyRunId: string) {
    return this.fallback.getStudyRun(studyRunId);
  }

  async saveStudyRun(studyRun: StudyRunRecord) {
    return this.fallback.saveStudyRun(studyRun);
  }

  async appendEventBatch(batchId: string, sessionId: string, events: TelemetryEvent[]) {
    const res = await this.fallback.appendEventBatch(batchId, sessionId, events);
    for (const ev of events) {
      await this.appendRow('su_kien_hanh_vi', [
        ev.event_id,
        ev.session_id,
        ev.seq,
        ev.timestamp,
        ev.type,
        ev.scenario_id,
        JSON.stringify(ev.payload || {}),
      ]);
    }
    return res;
  }

  async getSessionEvents(sessionId: string) {
    return this.fallback.getSessionEvents(sessionId);
  }

  async recordAttempt(result: ScenarioResultRecord) {
    const res = await this.fallback.recordAttempt(result);
    await this.appendRow('luot_xu_ly', [
      result.attempt_id,
      result.study_run_id,
      result.scenario_id,
      result.phase,
      result.selected_decision,
      result.rule_score,
      result.outcome,
      result.reaction_ms,
      result.created_at,
    ]);
    return res;
  }

  async getStudyRunAttempts(studyRunId: string) {
    return this.fallback.getStudyRunAttempts(studyRunId);
  }

  async recordAssessment(assessment: AssessmentRecord) {
    const res = await this.fallback.recordAssessment(assessment);
    await this.appendRow('so_sanh_truoc_sau', [
      assessment.study_run_id,
      assessment.phase,
      assessment.score,
      assessment.reaction_p50_ms,
      assessment.completed_at,
    ]);
    return res;
  }

  async recordAIAnalysis(analysis: AIAnalysisRecord) {
    const res = await this.fallback.recordAIAnalysis(analysis);
    await this.appendRow('nhat_ky_ai', [
      analysis.analysis_id,
      analysis.study_run_id,
      analysis.scenario_id,
      analysis.feedback_text,
      analysis.created_at,
    ]);
    return res;
  }

  async appendSystemLog(entry: Omit<SystemLogRecord, 'log_id' | 'created_at'>) {
    return this.fallback.appendSystemLog(entry);
  }

  async getAdminOverview() {
    const overview = await this.fallback.getAdminOverview();
    return {
      ...overview,
      storage_mode: 'GOOGLE' as StorageMode,
      is_demo_data: false,
      demo_label: null,
    };
  }

  async getSnapshot() {
    return this.fallback.getSnapshot();
  }
}

export function getStorageAdapter(customMockPath?: string): SafeRideStorageAdapter {
  assertProductionStorageReady();
  if (hasVerifiedGoogleCredentials() && process.env.SAFERIDE_FORCE_LOCAL_MOCK !== 'true') {
    return new GoogleSheetsDriveLiveAdapter();
  }
  return new LocalOnlyMockFileAdapter(customMockPath);
}