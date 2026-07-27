export interface MockStorageEnv {
  PLATFORM_DB: D1Database;
  GS_ARTIFACTS: R2Bucket;
}

type Area = 'mail' | 'mcp' | 'api';

const objectKey = (area: Area, id: string, name: string) =>
  `${area}/${new Date().toISOString().slice(0, 10)}/${id}/${name}`;

export async function putArtifact(
  env: MockStorageEnv,
  area: Area,
  id: string,
  name: string,
  body: string | ArrayBuffer,
  contentType = 'application/json'
): Promise<string> {
  const key = objectKey(area, id, name);
  await env.GS_ARTIFACTS.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: { area, recordId: id, mock: 'true' }
  });
  return key;
}

export async function queueMockMail(
  env: MockStorageEnv,
  input: { id: string; sender: string; recipient: string; subject: string; body: string }
) {
  const bodyKey = await putArtifact(env, 'mail', input.id, 'body.txt', input.body, 'text/plain');
  await env.PLATFORM_DB.prepare(
    `INSERT INTO mail_messages (id, sender, recipient, subject, body_object_key)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(input.id, input.sender, input.recipient, input.subject, bodyKey).run();
  return { id: input.id, status: 'queued', bodyKey };
}

export async function recordMockMcpCall(
  env: MockStorageEnv,
  input: { id: string; sessionId: string; tool: string; request: unknown; response: unknown; durationMs: number }
) {
  const requestKey = await putArtifact(env, 'mcp', input.id, 'request.json', JSON.stringify(input.request));
  const responseKey = await putArtifact(env, 'mcp', input.id, 'response.json', JSON.stringify(input.response));
  await env.PLATFORM_DB.prepare(
    `INSERT INTO mcp_tool_calls
      (id, session_id, tool_name, request_object_key, response_object_key, status, duration_ms)
     VALUES (?, ?, ?, ?, ?, 'mock-success', ?)`
  ).bind(input.id, input.sessionId, input.tool, requestKey, responseKey, input.durationMs).run();
  return { id: input.id, requestKey, responseKey };
}

export async function recordMockApiRequest(
  env: MockStorageEnv,
  input: { id: string; actorId?: string; method: string; route: string; request?: unknown; response?: unknown; statusCode: number; durationMs: number }
) {
  const requestKey = input.request === undefined ? null : await putArtifact(env, 'api', input.id, 'request.json', JSON.stringify(input.request));
  const responseKey = input.response === undefined ? null : await putArtifact(env, 'api', input.id, 'response.json', JSON.stringify(input.response));
  await env.PLATFORM_DB.prepare(
    `INSERT INTO api_requests
      (id, actor_id, method, route, status_code, request_object_key, response_object_key, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(input.id, input.actorId ?? null, input.method, input.route, input.statusCode, requestKey, responseKey, input.durationMs).run();
  return { id: input.id, requestKey, responseKey };
}
