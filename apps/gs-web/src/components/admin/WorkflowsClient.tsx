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
      if (!res.ok) throw new Error(`Failed to load workflows: ${res.statusText}`);

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
    return <div className="text-center py-12 text-gray-600">Loading workflows...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Workflows</h2>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded">
            + Create Workflow
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Filter by Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
        <div className="text-center py-12 text-gray-600">
          No workflows found. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
