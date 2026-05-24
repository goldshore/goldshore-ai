import { getAIClient } from './aiClient.js';

export async function generateResponse(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('prompt must be a non-empty string');
  }

  const client = getAIClient();

  const { data, response } = await client.chat.completions
    .create({
      model: 'dynamic/gs-gateway',
      messages: [{ role: 'user', content: prompt }],
    })
    .withResponse();

  return {
    text: data.choices?.[0]?.message?.content ?? '',
    gatewayId: response.headers.get('x-cf-ai-gateway-id') ?? null,
    raw: data,
  };
}
