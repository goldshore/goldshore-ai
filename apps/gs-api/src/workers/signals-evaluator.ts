import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { Env } from '../types';

export type SignalsEvaluatorParams = {
  signalId: string;
  source?: string;
  payload?: Record<string, unknown>;
};

export class SignalsEvaluator extends WorkflowEntrypoint<Env, SignalsEvaluatorParams> {
  async run(event: WorkflowEvent<SignalsEvaluatorParams>, step: WorkflowStep) {
    const signal = await step.do('normalize signal', async () => ({
      id: event.payload.signalId,
      source: event.payload.source ?? 'unknown',
      payload: event.payload.payload ?? {},
      evaluatedAt: new Date().toISOString(),
    }));

    await step.do('record evaluation', async () => {
      await this.env.KV.put(
        `signals:evaluations:${signal.id}`,
        JSON.stringify(signal),
        { expirationTtl: 30 * 24 * 60 * 60 },
      );
    });

    return signal;
  }
}

