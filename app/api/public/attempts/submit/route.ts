import { submitAttempt } from '../../../../../lib/api/services.ts';
import { errorResponse, json, readJson } from '../../../../../lib/api/response.ts';

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const out = await submitAttempt(req, body);
    return json(out, { status: out.duplicate ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

