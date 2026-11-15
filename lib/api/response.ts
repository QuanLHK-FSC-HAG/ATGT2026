import { DomainError } from '../validation/input.ts';

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {}),
    },
  });
}

export async function readJson(req: Request): Promise<unknown> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new DomainError(415, 'JSON_REQUIRED', 'Content-Type application/json is required');
  const length = Number(req.headers.get('content-length') || 0);
  if (length > 150000) throw new DomainError(413, 'PAYLOAD_TOO_LARGE', 'Payload exceeds API limit');
  try {
    return await req.json();
  } catch {
    throw new DomainError(400, 'INVALID_JSON', 'Malformed JSON body');
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } }, { status: 500 });
}

export function methodNotAllowed(allowed: string[]): Response {
  return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported method' } }, { status: 405, headers: { allow: allowed.join(', ') } });
}
