import assert from 'node:assert/strict';
import test from 'node:test';
import { getProvider, huggingFaceProvider, ollamaProvider } from './index';

test('registers Hugging Face and Ollama providers', () => {
  assert.equal(getProvider('huggingface'), huggingFaceProvider);
  assert.equal(getProvider('ollama'), ollamaProvider);
});

test('Hugging Face requires an access token', async () => {
  await assert.rejects(
    huggingFaceProvider.analyze(
      { prompt: 'health check' },
      { fetch, model: 'Qwen/Qwen3-32B' },
    ),
    /access token is missing/,
  );
});
