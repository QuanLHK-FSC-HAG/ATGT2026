import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getAdminStorage } from '../../../../lib/google/admin-storage.ts';
import { buildScenarioRows } from '../../../../lib/google/scenario-sync.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

const VISIBLE_SHEETS = [
  'bieu_do_thong_ke',
  'hoc_sinh',
  'phien_choi',
  'luot_xu_ly',
  'su_kien_hanh_vi',
  'nhat_ky_ai',
  'so_sanh_truoc_sau',
  'kich_ban_goc',
] as const;

export async function GET(req: Request) {
  try {
    const admin = requireAdmin(req);
    const storage = getAdminStorage(req);
    const liveEntries = await Promise.all(
      VISIBLE_SHEETS.map(async (name) => [name, await storage.readSheetRows(name)] as const),
    );
    const liveSheets = Object.fromEntries(liveEntries) as Record<(typeof VISIBLE_SHEETS)[number], string[][]>;
    if (storage.mode === 'LOCAL_DEMO_MOCK') {
      const snapshot = await storage.getSnapshot();
      const rows = (records: object[]): string[][] => {
        if (!records.length) return [];
        const keys = Object.keys(records[0]);
        return [keys, ...records.map(record => keys.map(key => {
          const value = (record as Record<string, unknown>)[key];
          return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        }))];
      };
      liveSheets.hoc_sinh = rows(snapshot.Players);
      liveSheets.phien_choi = rows(snapshot.Sessions);
      liveSheets.luot_xu_ly = rows(snapshot.ScenarioResults);
      liveSheets.so_sanh_truoc_sau = rows(snapshot.Assessments);
      liveSheets.nhat_ky_ai = rows(snapshot.AIAnalysis);
      liveSheets.su_kien_hanh_vi = rows(Object.values(snapshot.DriveEventBatches).flatMap(batch => batch.jsonl.split('\n').filter(Boolean).map(line => JSON.parse(line))));
    }
    const scenarioRows = liveSheets.kich_ban_goc.length > 1
      ? liveSheets.kich_ban_goc
      : buildScenarioRows();
    const sheets = { ...liveSheets, kich_ban_goc: scenarioRows };
    const counts = Object.fromEntries(
      VISIBLE_SHEETS.map(name => [name, Math.max(0, sheets[name].length - 1)]),
    ) as Record<(typeof VISIBLE_SHEETS)[number], number>;
    const sheetSources = Object.fromEntries(
      VISIBLE_SHEETS.map(name => [
        name,
        name === 'kich_ban_goc' && liveSheets.kich_ban_goc.length <= 1 ? 'LOCAL_SEED' : storage.mode === 'GOOGLE' ? 'GOOGLE_SHEETS' : 'LOCAL_SNAPSHOT',
      ]),
    );

    return json({
      admin_email: admin.email,
      source: storage.mode === 'GOOGLE' ? 'GOOGLE_SHEETS' : 'LOCAL_SNAPSHOT',
      sheet_id: storage.mode === 'GOOGLE' ? process.env.GOOGLE_SHEETS_ID || null : null,
      updated_at: new Date().toISOString(),
      sheets,
      counts,
      sheet_sources: sheetSources,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
