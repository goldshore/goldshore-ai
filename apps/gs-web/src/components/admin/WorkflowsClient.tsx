import React, { useState, useEffect } from 'react';
import WorkflowCard from './WorkflowCard';

interface Workflow {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  last_run?: string;
  next_run?: string;
  description?: string;
}

const API_BASE = '/api/admin/workflows';

export default function WorkflowsClient() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    loadWorkflows();
  }, [typeFilter]);

  const loadWorkflows = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        offset: '0',
        limit: '50',
      });
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`${API_BASE}?${params}`);
      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error('Admin API returned HTML (possible auth or routing issue)');
        }
        throw new Error(`Failed to load workflows: ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid response format: expected JSON');
      }

      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunWorkflow = async (workflowId: string) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/${workflowId}/run`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Failed to run workflow: ${res.statusText}`);
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow');
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Delete this workflow?')) return;

    try {
      setError(null);
      const res = await fetch(`${API_BASE}/${workflowId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to delete workflow: ${res.statusText}`);
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  if (isLoading) {
    return <div className="gs-empty gs-text-subtle">Loading workflows...</div>;
  }

  return (
    <div className="gs-stack">
      {error && (
        <div className="gs-alert gs-alert--error">
          {error}
        </div>
      )}

      <div className="gs-panel">
        <div className="gs-row gs-row--between">
          <h2>Workflows</h2>
          <button className="gs-button">
            + Create Workflow
          </button>
        </div>

        <div>
          <label>
            Filter by Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            <option value="leads_generator">Leads Generator</option>
            <option value="list_scraper">List Scraper</option>
            <option value="email_sender">Email Sender</option>
            <option value="tunnel_manager">Tunnel Manager</option>
            <option value="data_collector">Data Collector</option>
          </select>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="gs-empty gs-text-subtle">
          No workflows found. Create one to get started.
        </div>
      ) : (
        <div className="gs-list-grid">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onRun={handleRunWorkflow}
              onDelete={handleDeleteWorkflow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
