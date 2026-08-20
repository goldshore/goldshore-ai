import React, { useState } from 'react';
import { Play, Pause, Trash2, Settings, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  last_run?: string;
  next_run?: string;
}

interface WorkflowCardProps {
  workflow: Workflow;
  onRun?: (workflowId: string) => void;
  onPause?: (workflowId: string) => void;
  onDelete?: (workflowId: string) => void;
  onEdit?: (workflow: Workflow) => void;
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-800',
  running: 'bg-blue-100 text-blue-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  idle: <Clock className="w-4 h-4" />,
  running: <Play className="w-4 h-4" />,
  paused: <Pause className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  failed: <AlertCircle className="w-4 h-4" />,
};

export default function WorkflowCard({
  workflow,
  onRun,
  onPause,
  onDelete,
  onEdit,
}: WorkflowCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
          <p className="text-xs text-gray-600 capitalize mt-1">{workflow.type.replace('_', ' ')}</p>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 ${
            STATUS_COLORS[workflow.status]
          }`}
        >
          {STATUS_ICONS[workflow.status]}
          {workflow.status}
        </span>
      </div>

      <div className="text-xs text-gray-600 mb-4 space-y-1">
        {workflow.last_run && (
          <p>Last run: {new Date(workflow.last_run).toLocaleString()}</p>
        )}
        {workflow.next_run && (
          <p>Next run: {new Date(workflow.next_run).toLocaleString()}</p>
        )}
      </div>

      <div className="flex gap-2">
        {workflow.status === 'idle' && onRun && (
          <button
            onClick={() => onRun(workflow.id)}
            className="flex-1 px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-900 rounded flex items-center justify-center gap-1"
          >
            <Play className="w-4 h-4" />
            Run
          </button>
        )}
        {workflow.status === 'running' && onPause && (
          <button
            onClick={() => onPause(workflow.id)}
            className="flex-1 px-3 py-2 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded flex items-center justify-center gap-1"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(workflow)}
            className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 rounded flex items-center justify-center gap-1"
          >
            <Settings className="w-4 h-4" />
            Edit
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-3 py-2 text-sm hover:bg-gray-100 rounded"
          >
            ⋮
          </button>
          {showMenu && onDelete && (
            <button
              onClick={() => {
                onDelete(workflow.id);
                setShowMenu(false);
              }}
              className="absolute right-0 mt-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded shadow-lg text-red-600 hover:bg-red-50 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 inline mr-1" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
