import { randomUUID } from 'node:crypto';
import { issueParticipantToken, readParticipantFromRequest } from '../../../../lib/auth/session.ts';
import { getStorageAdapter } from '../../../../lib/google/storage.ts';
import { errorResponse, json, readJson } from '../../../../lib/api/response.ts';
import { deviceClass } from '../../../../lib/api/services.ts';
import { DomainError, noUnexpectedKeys, object, uuid } from '../../../../lib/validation/input.ts';
import type { SessionRecord } from '../../../../lib/types.ts';

export async function POST(req: Request) {
  try {
    const input = object(await readJson(req));
    noUnexpectedKeys(input, ['participant_id', 'study_run_id', 'device_class']);
    const participant_id = uuid(input.participant_id, 'participant_id');
    const study_run_id = uuid(input.study_run_id, 'study_run_id');

    // Reject minting sessions for arbitrary handles; require active cookie or registration proof
    let authorized = false;
    try {
      const active = readParticipantFromRequest(req);
      if (active.pid === participant_id && active.srid === study_run_id) authorized = true;
    } catch {
      authorized = false;
    }
    const registrationHeader = req.headers.get('x-saferide-registration-intent');
    if (!authorized && registrationHeader !== `participant:${participant_id}:${study_run_id}`) {
      throw new DomainError(403, 'FORBIDDEN_SESSION_REQUEST', 'Session creation requires active session or fresh registration header');
    }

    const storage = getStorageAdapter();
    const studyRun = await storage.getStudyRun(study_run_id);
    if (!studyRun || studyRun.participant_id !== participant_id) {
      throw new DomainError(404, 'STUDY_RUN_NOT_FOUND', 'Study run does not match participant');
    }

    const session_id = randomUUID();
    const ttlSeconds = Math.max(300, Math.min(86400, Number(process.env.SESSION_TTL_SECONDS) || 7200));
    const tokenInfo = issueParticipantToken({ session_id, participant_id, study_run_id }, ttlSeconds);
    const sessionRecord: SessionRecord = {
      session_id,
      participant_id,
      study_run_id,
      device_class: deviceClass(input.device_class),
      started_at: new Date().toISOString(),
      ended_at: null,
      expires_at: tokenInfo.expires_at,
      state: 'ACTIVE',
    };
    await storage.createSession(sessionRecord);

    return json({
      session_id,
      participant_id,
      study_run_id,
      expires_at: sessionRecord.expires_at,
      recovery_handle: { participant_id, study_run_id },
    }, {
      status: 201,
      headers: { 'set-cookie': tokenInfo.cookie },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
