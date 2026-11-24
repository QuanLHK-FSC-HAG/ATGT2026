import { createSign } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sheetId = process.env.GOOGLE_SHEETS_ID || '1cb1yNL0GlzktDg-88G-Q-POqCqPHnencAF5O-nC20J8';
const snapshotPath = resolve('data/research/synthetic-study-2026/logical_store.json');
const credentialPath = resolve('google/service-account.json');
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const serviceAccount = JSON.parse(readFileSync(credentialPath, 'utf8'));

if (process.env.OVERWRITE_GOOGLE_SHEETS !== 'true') {
  throw new Error('Set OVERWRITE_GOOGLE_SHEETS=true to confirm replacement.');
}
if (snapshot?.Settings?.synthetic !== true || snapshot?.Settings?.public_dataset !== true) {
  throw new Error('Only the verified public synthetic dataset may be uploaded.');
}

const now = Math.floor(Date.now() / 1000);
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
  iss: serviceAccount.client_email,
  scope: 'https://www.googleapis.com/auth/spreadsheets',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
})}`;
const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key, 'base64url');
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
});
if (!tokenResponse.ok) throw new Error(`Google authentication failed: ${tokenResponse.status}`);
const token = (await tokenResponse.json()).access_token;
const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}`;
const request = async (url, options = {}) => {
  const response = await fetch(`${base}${url}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) throw new Error(`Google Sheets request failed ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};

const metadata = await request('?fields=properties.title,sheets.properties(sheetId,title,hidden,gridProperties.rowCount)');
const existingTitles = new Set(metadata.sheets.map(sheet => sheet.properties.title));
const backup = {};
for (const title of existingTitles) {
  const range = encodeURIComponent(`'${title.replaceAll("'", "''")}'!A:Z`);
  backup[title] = (await request(`/values/${range}`)).values || [];
}
const backupDir = resolve('.runtime/google-backups');
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-');
writeFileSync(resolve(backupDir, `${stamp}.json`), JSON.stringify({ sheetId, metadata, sheets: backup }, null, 2));

const headers = {
  hoc_sinh: ['participant_id', 'study_run_id', 'full_name', 'class_name', 'school_name', 'province_city', 'privacy_notice_version', 'created_at'],
  phien_choi: ['session_id', 'participant_id', 'mode', 'view', 'difficulty', 'device_class', 'started_at', 'state'],
  su_kien_hanh_vi: ['event_id', 'attempt_id', 'session_id', 'event_type', 'timestamp_ms', 'speed_kmh', 'distance_to_hazard_m'],
  luot_xu_ly: ['attempt_id', 'session_id', 'participant_id', 'scenario_id', 'phase', 'selected_decision', 'outcome', 'reaction_ms', 'rule_score', 'created_at'],
  so_sanh_truoc_sau: ['study_run_id', 'participant_id', 'pre_score', 'post_score', 'delta', 'pre_completion_time_ms', 'post_completion_time_ms'],
  nhat_ky_ai: ['analysis_id', 'pseudonymous_ref', 'scenario_id', 'feedback', 'safety_principle', 'created_at'],
};
const assessmentByRun = new Map();
for (const row of snapshot.Assessments) {
  const item = assessmentByRun.get(row.study_run_id) || { study_run_id: row.study_run_id, participant_id: row.participant_id };
  if (row.phase === 'PRE') { item.pre_score = row.raw_score; item.pre_time = row.completion_time_ms; }
  if (row.phase === 'POST') { item.post_score = row.raw_score; item.post_time = row.completion_time_ms; }
  assessmentByRun.set(row.study_run_id, item);
}
const eventRows = [];
for (const batch of Object.values(snapshot.DriveEventBatches)) {
  for (const line of batch.jsonl.split('\n').filter(Boolean)) {
    const event = JSON.parse(line);
    eventRows.push([event.event_id, event.payload?.attempt_id || '', event.session_id, event.type, Date.parse(event.timestamp) || '', event.payload?.speed_kmh || '', event.payload?.distance_to_hazard_m || event.payload?.distance_m || '']);
  }
}
const outcome = value => value === 'SAFE' ? 'ĐÚNG' : value === 'SUBOPTIMAL' ? 'TẠM ĐƯỢC' : value === 'HAZARDOUS' ? 'SAI' : 'KHÔNG HỢP LỆ';
const data = {
  hoc_sinh: snapshot.Players.map(player => { const run = snapshot.StudyRuns.find(item => item.participant_id === player.participant_id); return [player.participant_id, run?.study_run_id || '', player.full_name, player.class_name, player.school_name, player.province_city, player.privacy_notice_version, player.created_at]; }),
  phien_choi: snapshot.Sessions.map(row => [row.session_id, row.participant_id, 'Cơ bản', '3D', 'CO_BAN', row.device_class, row.started_at, row.state]),
  su_kien_hanh_vi: eventRows,
  luot_xu_ly: snapshot.ScenarioResults.map(row => [row.attempt_id, row.session_id, row.participant_id, row.scenario_id, row.phase, row.selected_decision, outcome(row.outcome), row.reaction_ms ?? '', row.rule_score, row.created_at]),
  so_sanh_truoc_sau: [...assessmentByRun.values()].map(row => [row.study_run_id, row.participant_id, row.pre_score ?? '', row.post_score ?? '', row.pre_score != null && row.post_score != null ? row.post_score - row.pre_score : '', row.pre_time ?? '', row.post_time ?? '']),
  nhat_ky_ai: snapshot.AIAnalysis.map(row => [row.analysis_id, row.pseudonymous_ref, row.scenario_id, `${row.error_explanation}\n\nGợi ý: ${row.suggested_practice}`, row.safety_principle, row.created_at]),
};

const missing = Object.keys(data).filter(title => !existingTitles.has(title));
if (missing.length) {
  await request(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: missing.map(title => ({ addSheet: { properties: { title } } })) }) });
}
const refreshedMetadata = await request('?fields=sheets.properties(sheetId,title,gridProperties.rowCount)');
const rowRequirements = new Map(Object.entries(data).map(([title, rows]) => [title, rows.length + 1]));
rowRequirements.set('_trang_thai', Math.ceil(JSON.stringify({ ...snapshot, storage_mode: 'GOOGLE', demo_banner: null }).length / 40000) + 1);
const resizeRequests = refreshedMetadata.sheets
  .filter(sheet => rowRequirements.has(sheet.properties.title) && sheet.properties.gridProperties.rowCount < rowRequirements.get(sheet.properties.title))
  .map(sheet => ({ updateSheetProperties: { properties: { sheetId: sheet.properties.sheetId, gridProperties: { rowCount: rowRequirements.get(sheet.properties.title) } }, fields: 'gridProperties.rowCount' } }));
if (resizeRequests.length) await request(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: resizeRequests }) });
for (const title of Object.keys(data)) {
  await request(`/values/${encodeURIComponent(`'${title}'!A:Z`)}:clear`, { method: 'POST', body: '{}' });
}

const stateSnapshot = { ...snapshot, storage_mode: 'GOOGLE', demo_banner: null };
const stateText = JSON.stringify(stateSnapshot);
const chunks = [];
for (let i = 0; i < stateText.length; i += 40000) chunks.push([String(chunks.length), stateText.slice(i, i + 40000)]);
chunks.push(['-1', '']);
if (!existingTitles.has('_trang_thai')) {
  await request(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: '_trang_thai', hidden: true } } }] }) });
}
await request(`/values/${encodeURIComponent("'_trang_thai'!A:B")}:clear`, { method: 'POST', body: '{}' });

const writeRows = async (title, rows, batchSize = 500) => {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const values = rows.slice(offset, offset + batchSize);
    await request(`/values/${encodeURIComponent(`'${title}'!A${offset + 1}`)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
  }
};
for (const [title, rows] of Object.entries(data)) {
  await writeRows(title, [headers[title], ...rows]);
}
await writeRows('_trang_thai', chunks, 100);
console.log(JSON.stringify({ spreadsheet: metadata.properties.title, sheetId, backup: resolve(backupDir, `${stamp}.json`), rows: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])) }, null, 2));
