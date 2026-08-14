import React, { useState } from 'react';
import { Table } from './Table';
import { Pagination } from './Pagination';
import { FilterBar } from './FilterBar';

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  created_at: string;
  sent_at?: string;
  error_message?: string;
}

interface EmailManagerProps {
  jwtToken: string;
  initialLogs: {
    items: EmailLog[];
    total: number;
    offset: number;
    limit: number;
    error?: string | null;
  };
}

export default function EmailManager({ jwtToken, initialLogs }: EmailManagerProps) {
  const [logs, setLogs] = useState<EmailLog[]>(initialLogs.items || []);
  const [total, setTotal] = useState(initialLogs.total || 0);
  const [offset, setOffset] = useState(initialLogs.offset || 0);
  const [limit, setLimit] = useState(initialLogs.limit || 25);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const fetchLogs = async (newOffset: number, filters: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(newOffset),
        limit: String(limit),
        ...filters,
      });

      const response = await fetch(`https://api.goldshore.ai/admin/email/logs?${params}`, {
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.items || []);
        setTotal(data.total || 0);
        setOffset(newOffset);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async (emailId: string) => {
    setResending(emailId);
    try {
      const response = await fetch(`https://api.goldshore.ai/admin/email/logs/${emailId}/resend`, {
        method: 'POST',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Refresh logs after resend
        await fetchLogs(offset);
        setSelectedLog(null);
      } else {
        console.error('Failed to resend email');
      }
    } catch (error) {
      console.error('Error resending email:', error);
    } finally {
      setResending(null);
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    if (!confirm('Are you sure you want to delete this email log?')) return;

    try {
      const response = await fetch(`https://api.goldshore.ai/admin/email/logs/${emailId}`, {
        method: 'DELETE',
        headers: {
          'CF-Authorization': jwtToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchLogs(offset);
        setSelectedLog(null);
      }
    } catch (error) {
      console.error('Error deleting email:', error);
    }
  };

  const filters = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        filters={filters}
        onFilter={(filters) => fetchLogs(0, filters)}
      />

      <Table<EmailLog>
        columns={[
          { key: 'recipient', label: 'Recipient' },
          { key: 'subject', label: 'Subject' },
          {
            key: 'status',
            label: 'Status',
            render: (status) => (
              <span
                className={`px-2 py-1 text-xs font-semibold rounded ${
                  status === 'sent'
                    ? 'bg-green-100 text-green-800'
                    : status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {status}
              </span>
            ),
          },
          { key: 'created_at', label: 'Created', width: '180px' },
        ]}
        data={logs}
        loading={loading}
        onRowClick={setSelectedLog}
        emptyMessage="No email logs found"
      />

      <Pagination
        total={total}
        offset={offset}
        limit={limit}
        onOffsetChange={fetchLogs}
      />

      {selectedLog && (
        <div className="gs-card space-y-4">
          <h3 className="text-lg font-semibold">Email Details</h3>
          <div className="space-y-2">
            <div>
              <p className="text-sm gs-text-subtle">Recipient</p>
              <p className="font-mono text-sm">{selectedLog.recipient}</p>
            </div>
            <div>
              <p className="text-sm gs-text-subtle">Subject</p>
              <p>{selectedLog.subject}</p>
            </div>
            <div>
              <p className="text-sm gs-text-subtle">Status</p>
              <p className="font-semibold capitalize">{selectedLog.status}</p>
            </div>
            <div>
              <p className="text-sm gs-text-subtle">Created</p>
              <p>{new Date(selectedLog.created_at).toLocaleString()}</p>
            </div>
            {selectedLog.sent_at && (
              <div>
                <p className="text-sm gs-text-subtle">Sent</p>
                <p>{new Date(selectedLog.sent_at).toLocaleString()}</p>
              </div>
            )}
            {selectedLog.error_message && (
              <div>
                <p className="text-sm gs-text-subtle">Error</p>
                <p className="text-red-600 font-mono text-xs">{selectedLog.error_message}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {selectedLog.status === 'failed' && (
              <button
                onClick={() => handleResendEmail(selectedLog.id)}
                disabled={resending === selectedLog.id}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {resending === selectedLog.id ? 'Resending...' : 'Resend Email'}
              </button>
            )}
            <button
              onClick={() => handleDeleteEmail(selectedLog.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedLog(null)}
              className="px-4 py-2 text-sm font-medium border rounded gs-text-subtle hover:bg-opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
