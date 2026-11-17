import { issueParticipantToken } from '../../../../lib/auth/session.ts';
import { getStorageAdapter } from '../../../../lib/google/storage.ts';
import { errorResponse, json, readJson } from '../../../../lib/api/response.ts';
import { newParticipantRecords } from '../../../../lib/api/services.ts';
import { participantInput } from '../../../../lib/validation/input.ts';

export async function POST(req: Request) {
  try {
    const valid = participantInput(await readJson(req));
    const storage = getStorageAdapter();
    const { player, studyRun } = newParticipantRecords(valid);
    await storage.createParticipantAndStudyRun(player, studyRun);
    return json({
      participant_id: player.participant_id,
      study_run_id: studyRun.study_run_id,
      phase: studyRun.current_phase,
      state: studyRun.state,
      storage_mode: storage.mode,
      created_at: player.created_at,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
