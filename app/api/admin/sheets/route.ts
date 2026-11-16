import { requireAdmin } from '../../../../lib/auth/session.ts';
import { getStorageAdapter, hasVerifiedGoogleCredentials } from '../../../../lib/google/storage.ts';
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
    const storage = getStorageAdapter();
    const entries = await Promise.all(
      VISIBLE_SHEETS.map(async (name) => [name, await storage.readSheetRows(name)] as const),
    );
    const sheets = Object.fromEntries(entries) as Record<(typeof VISIBLE_SHEETS)[number], string[][]>;
    const counts = Object.fromEntries(
      entries.map(([name, rows]) => [name, Math.max(0, rows.length - 1)]),
    ) as Record<(typeof VISIBLE_SHEETS)[number], number>;

    return json({
      admin_email: admin.email,
      source: hasVerifiedGoogleCredentials() ? 'GOOGLE_SHEETS' : 'LOCAL_SNAPSHOT',
      sheet_id: process.env.GOOGLE_SHEETS_ID || null,
      updated_at: new Date().toISOString(),
      sheets,
      counts,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
