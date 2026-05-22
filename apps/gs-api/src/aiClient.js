import OpenAI from 'openai';

let aiClient;

export function readGatewayConfig() {
  const baseURL = process.env.CF_GATEWAY_URL;
  const apiKey = process.env.CF_AIG_TOKEN;

  if (!baseURL || !apiKey) {
    throw new Error(
      'Missing AI Gateway configuration. Set CF_GATEWAY_URL and CF_AIG_TOKEN in env, .env, or .dev.vars.',
    );
  }

  return { baseURL, apiKey };
}

export function getAIClient() {
  if (aiClient) {
    return aiClient;
  }

  const { baseURL, apiKey } = readGatewayConfig();

  aiClient = new OpenAI({
    apiKey,
    baseURL,
  });

  return aiClient;
}

export function resetAIClientForTests() {
  aiClient = undefined;
}
