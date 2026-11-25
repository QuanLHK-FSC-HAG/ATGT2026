import { errorResponse, json } from '../../../../lib/api/response.ts';
import { getStorageAdapter } from '../../../../lib/google/storage.ts';
import { playersFromLiveSheet, summarizePlayers } from '../../../../lib/public/participation-summary.ts';

export async function GET() {
  try {
    const storage = getStorageAdapter();
    const liveRows = storage.mode === 'GOOGLE' ? await storage.readSheetRows('hoc_sinh') : [];
    const livePlayers = playersFromLiveSheet(liveRows);
    const players = livePlayers.length ? livePlayers : (await storage.getSnapshot()).Players;
    return json({ ...summarizePlayers(players), updated_at: new Date().toISOString(), source: storage.mode });
  } catch (error) {
    return errorResponse(error);
  }
}
