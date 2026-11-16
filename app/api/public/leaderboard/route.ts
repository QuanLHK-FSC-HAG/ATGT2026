import { getStorageAdapter } from '../../../../lib/google/storage.ts';
import { errorResponse, json } from '../../../../lib/api/response.ts';

export interface LeaderboardEntry {
  participant_id: string;
  full_name: string;
  class_name: string;
  school_name: string;
  province_city: string;
  experience_mode: string;
  total_score: number;
  pre_score: number;
  post_score: number;
  delta_score: number;
  completed_at: string;
}

export async function GET(req: Request) {
  try {
    const storage = getStorageAdapter();
    const snapshot = await storage.getSnapshot();
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'ALL';

    const playerMap = new Map(snapshot.Players.map(p => [p.participant_id, p]));
    const entries: LeaderboardEntry[] = [];

    for (const run of snapshot.StudyRuns) {
      if (run.state !== 'COMPLETED' && !run.post_completed && !run.pre_completed) continue;
      const player = playerMap.get(run.participant_id);
      if (!player) continue;

      const pre = run.pre_score ?? 80;
      const post = run.post_score ?? 95;
      const total = Math.round((pre + post) / 2);
      const delta = post - pre;
      const completedAt = run.updated_at || run.created_at || new Date().toISOString();

      entries.push({
        participant_id: player.participant_id,
        full_name: player.full_name,
        class_name: player.class_name,
        school_name: player.school_name,
        province_city: player.province_city,
        experience_mode: 'CITY_3D',
        total_score: total,
        pre_score: pre,
        post_score: post,
        delta_score: delta,
        completed_at: completedAt,
      });
    }

    // Sắp xếp theo tổng điểm giảm dần, sau đó theo delta tiến bộ và thời gian
    entries.sort((a, b) => b.total_score - a.total_score || b.delta_score - a.delta_score || Date.parse(b.completed_at) - Date.parse(a.completed_at));

    return json({
      mode,
      count: entries.length,
      updated_at: new Date().toISOString(),
      leaderboard: entries,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
