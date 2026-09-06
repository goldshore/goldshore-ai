import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { Env } from '../types';

export type EditorialProductionParams = {
  intakeId: string;
  objectId: string;
  title?: string;
  sourceLeads?: string[];
  rightsConfirmed?: boolean;
  evidenceConfirmed?: boolean;
};

export type EditorialProductionResult = {
  intakeId: string;
  objectId: string;
  stages: Array<{ name: string; status: 'complete' | 'blocked' }>;
  release: 'gated' | 'ready';
  reason?: string;
};

const requiredId = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) throw new Error(`${field} is required`);
  return normalized;
};

/**
 * Durable orchestration seam for the GearSwipe editorial production desk.
 * Steps deliberately produce drafts and gates; publishing is a separate,
 * human-approved operation that will be added after the object/evidence schema
 * is live in D1 and originals are persisted to R2.
 */
export class EditorialProductionWorkflow extends WorkflowEntrypoint<Env, EditorialProductionParams> {
  async run(
    event: WorkflowEvent<EditorialProductionParams>,
    step: WorkflowStep,
  ): Promise<EditorialProductionResult> {
    const intake = await step.do('validate intake', async () => ({
      intakeId: requiredId(event.payload.intakeId, 'intakeId'),
      objectId: requiredId(event.payload.objectId, 'objectId'),
      title: event.payload.title?.trim() || 'Untitled object',
    }));

    const research = await step.do('prepare research brief', async () => ({
      sourceLeads: (event.payload.sourceLeads ?? []).map((lead) => lead.trim()).filter(Boolean),
      prompt: `Research ${intake.title} using attributable sources; separate claims from evidence.`,
      status: 'draft' as const,
    }));

    const appraisal = await step.do('prepare provisional appraisal', async () => ({
      status: research.sourceLeads.length > 0 ? ('draft' as const) : ('blocked' as const),
      reason: research.sourceLeads.length > 0 ? undefined : 'At least one comparable source is required.',
    }));

    const verification = await step.do('apply human verification gate', async () => ({
      status: event.payload.evidenceConfirmed ? ('complete' as const) : ('blocked' as const),
      reason: event.payload.evidenceConfirmed ? undefined : 'Human evidence verification is required.',
    }));

    const editorial = await step.do('prepare editorial draft', async () => ({
      status: verification.status === 'complete' && appraisal.status === 'draft'
        ? ('complete' as const)
        : ('blocked' as const),
    }));

    const release = await step.do('evaluate release gate', async () => {
      const ready = Boolean(
        event.payload.rightsConfirmed &&
        verification.status === 'complete' &&
        editorial.status === 'complete',
      );
      return {
        status: ready ? ('ready' as const) : ('gated' as const),
        reason: ready ? undefined : 'Rights, evidence, and editorial approval must be complete.',
      };
    });

    return {
      intakeId: intake.intakeId,
      objectId: intake.objectId,
      stages: [
        { name: 'intake', status: 'complete' },
        { name: 'research', status: 'complete' },
        { name: 'appraisal', status: appraisal.status === 'draft' ? 'complete' : 'blocked' },
        { name: 'verification', status: verification.status },
        { name: 'editorial', status: editorial.status },
        { name: 'release', status: release.status === 'ready' ? 'complete' : 'blocked' },
      ],
      release: release.status,
      reason: release.reason,
    };
  }
}
