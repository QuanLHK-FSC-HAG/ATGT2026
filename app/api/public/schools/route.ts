import { errorResponse, json } from '../../../../lib/api/response.ts';
import { getStorageAdapter } from '../../../../lib/google/storage.ts';
import { distinctSchoolNames, schoolsFromLiveSheet } from '../../../../lib/public/school-suggestions.ts';

// Short-lived in-memory cache so the entry card does not re-read the sheet
// on every page load. Best-effort per server instance: instances may hold
// different cached lists for up to the TTL, correctness is unaffected.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { at: number; schools: string[] } | null = null;

export async function GET() {
  try {
    const storage = getStorageAdapter();
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return json({
        schools: cached.schools,
        total: cached.schools.length,
        updated_at: new Date(cached.at).toISOString(),
        source: storage.mode,
      });
    }
    const liveRows = storage.mode === 'GOOGLE' ? await storage.readSheetRows('hoc_sinh') : [];
    const liveSchools = schoolsFromLiveSheet(liveRows);
    const schools = liveSchools.length ? liveSchools : distinctSchoolNames((await storage.getSnapshot()).Players);
    cached = { at: Date.now(), schools };
    return json({ schools, total: schools.length, updated_at: new Date().toISOString(), source: storage.mode });
  } catch (error) {
    return errorResponse(error);
  }
}
