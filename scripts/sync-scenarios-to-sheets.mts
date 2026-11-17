import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Lưu TOÀN BỘ 160 kịch bản đã chuyển thành cảnh game chơi được vào kich_ban_goc.
const saPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || resolve(process.cwd(), 'google/service-account.json');
if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(readFileSync(saPath)).toString('base64');
}
if (!process.env.GOOGLE_SHEETS_ID) {
  process.env.GOOGLE_SHEETS_ID = '1cb1yNL0GlzktDg-88G-Q-POqCqPHnencAF5O-nC20J8';
}

const { syncScenariosToSheets } = await import('../lib/google/scenario-sync.ts');
const result = await syncScenariosToSheets();
console.log('SCENARIOS_SYNCED', JSON.stringify(result));
