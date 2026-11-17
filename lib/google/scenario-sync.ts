import { createSign } from 'node:crypto';
import { SEED_PLAYABLE_SCENARIOS } from '../rules/engine.ts';

export const SCENARIO_SHEET = 'kich_ban_goc';

export const SCENARIO_COLUMNS = [
  'scenario_id',
  'version',
  'title_vi',
  'target_grade',
  'skill_group',
  'difficulty',
  'vehicle_group',
  'npc_element',
  'correct_action',
  'trigger_event',
  'phase_eligibility',
  'prompt_vi',
  'hazard_cue_vi',
  'option_safe',
  'option_rush',
  'option_ignore',
  'error_group',
  'safety_principle_vi',
  'standard_explanation_vi',
  'suggested_practice_vi',
  'status',
  'scene_type',
  'updated_at',
] as const;

function scenarioSceneType(npc: string, event: string): string {
  const raw = `${npc} ${event}`.toLowerCase();
  if (/truck|bus|blind|diem_mu/.test(raw)) return 'BLIND_SPOT';
  if (/traffic|light|red|den/.test(raw)) return 'TRAFFIC_LIGHT';
  if (/pedestrian|crosswalk|nguoi/.test(raw)) return 'PEDESTRIAN';
  if (/intersection|yield|nga/.test(raw)) return 'INTERSECTION';
  if (/door|mo_cua/.test(raw)) return 'CAR_DOOR';
  return 'SCHOOL_ZONE';
}

async function getAccessToken(): Promise<string> {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is missing');
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as { client_email: string; private_key: string };
  const b64url = (buf: Buffer) => buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(sa.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claim}.${sig}`,
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error(`Google token failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

export function buildScenarioRows(): string[][] {
  const updatedAt = new Date().toISOString();
  const rows = SEED_PLAYABLE_SCENARIOS.map((s) => [
    s.scenario_id,
    s.version,
    s.title_vi,
    s.target_grade || '',
    s.skill_group || '',
    String(s.difficulty),
    s.vehicle_group,
    s.npc_element || '',
    s.correct_action || '',
    s.trigger_event || '',
    s.phase_eligibility.join('|'),
    s.prompt_vi,
    s.hazard_cue_vi,
    s.options[0]?.label_vi || '',
    s.options[1]?.label_vi || '',
    s.options[2]?.label_vi || '',
    s.rubric.error_group,
    s.rubric.safety_principle_vi,
    s.rubric.standard_explanation_vi,
    s.rubric.suggested_practice_vi,
    'READY_FOR_GAME',
    scenarioSceneType(s.npc_element || '', s.trigger_event || ''),
    updatedAt,
  ]);
  return [[...SCENARIO_COLUMNS], ...rows];
}

export async function syncScenariosToSheets(): Promise<{ count: number; columns: number; sheet_id: string; updated_at: string }> {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEETS_ID is missing');
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const rows = buildScenarioRows();
  const lastRow = rows.length;
  const lastCol = SCENARIO_COLUMNS.length;
  const lastColLetter = String.fromCharCode(64 + lastCol);
  const range = encodeURIComponent(`${SCENARIO_SHEET}!A1:${lastColLetter}${lastRow}`);

  const write = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: rows }),
  });
  if (!write.ok) throw new Error(`Scenario write failed: ${write.status} ${await write.text()}`);

  // Định dạng lại header/filter/freeze để sheet dễ đọc sau khi ghi đầy đủ 23 cột.
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(sheetId,title)`, { headers });
  const meta = await metaRes.json() as { sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> };
  const gridId = meta.sheets?.find(s => s.properties?.title === SCENARIO_SHEET)?.properties?.sheetId;
  if (typeof gridId === 'number') {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: gridId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.36, blue: 0.68 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId: gridId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          {
            setBasicFilter: {
              filter: { range: { sheetId: gridId, startRowIndex: 0, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: lastCol } },
            },
          },
        ],
      }),
    });
  }

  return { count: rows.length - 1, columns: lastCol, sheet_id: sheetId, updated_at: new Date().toISOString() };
}
