#!/usr/bin/env node
/**
 * SafeRide EDU AI 2026 - Google Drive & Sheets Auto-Provisioner
 * Target Owner Account: quanlhk.01@gmail.com
 * Target Root Folder: ATGT2026
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const NINE_RESEARCH_SHEETS = [
  {
    title: 'participants',
    headers: ['participant_id', 'session_id', 'display_name', 'class_name', 'school_name', 'province_name', 'location_verification_status', 'consent_acknowledged', 'consent_version', 'created_at', 'is_pilot_test']
  },
  {
    title: 'sessions',
    headers: ['session_id', 'participant_id', 'study_phase', 'started_at', 'completed_at', 'device_type', 'viewport_w', 'viewport_h', 'rule_engine_version', 'status']
  },
  {
    title: 'scenario_attempts',
    headers: ['attempt_id', 'session_id', 'participant_id', 'scenario_id', 'study_phase', 'started_at', 'ended_at', 'reaction_time_ms', 'decision_action', 'is_correct', 'total_score', 'rule_engine_version']
  },
  {
    title: 'behavior_events',
    headers: ['event_id', 'attempt_id', 'session_id', 'scenario_id', 'event_type', 'timestamp_offset_ms', 'speed_kmh', 'distance_to_hazard_m', 'payload_json']
  },
  {
    title: 'ai_feedback_logs',
    headers: ['feedback_id', 'attempt_id', 'scenario_id', 'model_name', 'fallback_used', 'pii_blocked', 'latency_ms', 'feedback_summary', 'created_at']
  },
  {
    title: 'pre_post_comparisons',
    headers: ['comparison_id', 'participant_id', 'session_id', 'pre_score_avg', 'post_score_avg', 'score_delta', 'pre_reaction_ms_avg', 'post_reaction_ms_avg', 'reaction_delta_ms', 'computed_at']
  },
  {
    title: 'scenarios_master',
    headers: ['scenario_id', 'version', 'status', 'target_grade', 'skill_group', 'cognitive_level', 'vehicle_type', 'scenario_title', 'npc_element', 'correct_action', 'legal_reference', 'trigger_condition_json', 'content_review_status']
  },
  {
    title: 'admin_audit_logs',
    headers: ['audit_id', 'admin_email', 'action_type', 'target_resource', 'ip_hash', 'status', 'created_at']
  },
  {
    title: 'system_health_logs',
    headers: ['log_id', 'component', 'severity', 'latency_ms', 'error_code', 'message', 'created_at']
  }
];

function createJwtAssertion(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  return `${header}.${claim}.${signature}`;
}

async function getAccessToken(serviceAccount) {
  const assertion = createJwtAssertion(serviceAccount);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  if (!res.ok) {
    throw new Error(`Google OAuth Token failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function main() {
  const saFile = path.resolve(process.cwd(), '../service-account.json');
  const envPath = path.resolve(process.cwd(), '.env.local');

  let saBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || '';
  if (!saBase64 && fs.existsSync(saFile)) {
    const raw = fs.readFileSync(saFile, 'utf8');
    saBase64 = Buffer.from(raw, 'utf8').toString('base64');
  }

  if (!saBase64) {
    console.log(JSON.stringify({
      status: 'WAITING_FOR_SERVICE_ACCOUNT_JSON',
      owner_email: 'quanlhk.01@gmail.com',
      target_drive_folder: 'ATGT2026',
      expected_sheets_count: NINE_RESEARCH_SHEETS.length,
      sheets: NINE_RESEARCH_SHEETS.map(s => s.title),
      instruction: 'Place service-account.json in E:\\ATGT 2026\\service-account.json or set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 in .env.local to auto-create ATGT2026 folder and 9 research sheets.'
    }, null, 2));
    return;
  }

  const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf8'));
  const token = await getAccessToken(serviceAccount);

  // 1. Create folder ATGT2026 on Google Drive
  const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'ATGT2026',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  if (!folderRes.ok) {
    throw new Error(`Drive Folder creation failed: ${folderRes.status} ${await folderRes.text()}`);
  }
  const folder = await folderRes.json();

  // 2. Share folder with quanlhk.01@gmail.com as writer/organizer
  await fetch(`https://www.googleapis.com/drive/v3/files/${folder.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: 'writer',
      type: 'user',
      emailAddress: 'quanlhk.01@gmail.com'
    })
  });

  // 3. Create Master Research Spreadsheet with 9 Tabs
  const sheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title: 'SafeRide_EDU_AI_2026_Research_DB' },
      sheets: NINE_RESEARCH_SHEETS.map((s, idx) => ({
        properties: {
          sheetId: idx + 1,
          title: s.title,
          gridProperties: { frozenRowCount: 1 }
        },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: s.headers.map(h => ({
              userEnteredValue: { stringValue: h }
            }))
          }]
        }]
      }))
    })
  });
  if (!sheetRes.ok) {
    throw new Error(`Spreadsheet creation failed: ${sheetRes.status} ${await sheetRes.text()}`);
  }
  const spreadsheet = await sheetRes.json();

  // Move spreadsheet into ATGT2026 folder
  await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheet.spreadsheetId}?addParents=${folder.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` }
  });

  // Update .env.local
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  envContent += `\nGOOGLE_DRIVE_FOLDER_ID=${folder.id}\nGOOGLE_SHEETS_ID=${spreadsheet.spreadsheetId}\nGOOGLE_SERVICE_ACCOUNT_JSON_BASE64=${saBase64}\n`;
  fs.writeFileSync(envPath, envContent);

  console.log(JSON.stringify({
    status: 'PROVISIONED',
    folderId: folder.id,
    spreadsheetId: spreadsheet.spreadsheetId,
    ownerShared: 'quanlhk.01@gmail.com'
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
