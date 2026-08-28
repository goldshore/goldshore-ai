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
  idle: '',
  running: 'info',
  paused: 'warning',
  completed: 'success',
  failed: 'danger',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  idle: <Clock className="gs-icon" />,
  running: <Play className="gs-icon" />,
  paused: <Pause className="gs-icon" />,
  completed: <CheckCircle className="gs-icon" />,
  failed: <AlertCircle className="gs-icon" />,
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
    <div className="gs-panel transition-shadow">
      <div>
        <div>
          <h3>{workflow.name}</h3>
          <p className="gs-cell-meta">{workflow.type.replace('_', ' ')}</p>
        </div>
        <span
          className={`gs-row ${
 STATUS_COLORS[workflow.status]
 }`}
        >
          {STATUS_ICONS[workflow.status]}
          {workflow.status}
        </span>
      </div>

      <div className="gs-input-group">
        {workflow.last_run && (
          <p>Last run: {new Date(workflow.last_run).toLocaleString()}</p>
        )}
        {workflow.next_run && (
          <p>Next run: {new Date(workflow.next_run).toLocaleString()}</p>
        )}
      </div>

      <div className="gs-row">
        {workflow.status === 'idle' && onRun && (
          <button
            onClick={() => onRun(workflow.id)}
            className="gs-row"
          >
            <Play className="gs-icon" />
            Run
          </button>
        )}
        {workflow.status === 'running' && onPause && (
          <button
            onClick={() => onPause(workflow.id)}
            className="gs-row"
          >
            <Pause className="gs-icon" />
            Pause
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(workflow)}
            className="gs-row"
          >
            <Settings className="gs-icon" />
            Edit
          </button>
        )}
        <div>
          <button
            onClick={() => setShowMenu(!showMenu)}
          >
            ⋮
          </button>
          {showMenu && onDelete && (
            <button
              onClick={() => {
                onDelete(workflow.id);
                setShowMenu(false);
              }}
              className="gs-alert gs-alert--error gs-panel"
            >
              <Trash2 className="gs-icon gs-icon--inline" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
