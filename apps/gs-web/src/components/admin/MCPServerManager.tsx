import React, { useState, useEffect } from 'react';
import { Play, ChevronDown, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface MCPServer {
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  tools: Array<{ name: string; description: string }>;
  lastActive?: string;
  errorMessage?: string;
}

interface Props {
  jwtToken?: string;
}

export default function MCPServerManager({ jwtToken }: Props) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/mcp/servers', {
        headers: {
          ...(jwtToken ? { 'CF-Authorization': jwtToken } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTool = async (serverName: string, toolName: string) => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const response = await fetch('/api/admin/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(jwtToken ? { 'CF-Authorization': jwtToken } : {}),
        },
        body: JSON.stringify({
          server: serverName,
          tool: toolName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setExecutionResult(JSON.stringify(data.result, null, 2));
      } else {
        const error = await response.json().catch(() => ({}));
        setExecutionResult(`Error: ${error.message || 'Failed to execute tool'}`);
      }
    } catch (error) {
      setExecutionResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="gs-stack-sm">
        <div>
          {[1, 2, 3].map((i) => (
            <div key={i} ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="gs-stack-sm">
      {servers.length === 0 ? (
        <div>
          <AlertCircle className="gs-icon gs-icon--lg gs-icon--inline" />
          No MCP servers available. Ensure servers are configured and running.
        </div>
      ) : (
        servers.map((server) => (
          <div
            key={server.name}
            className="gs-panel"
          >
            <div
              className="gs-row gs-row--between"
              onClick={() =>
                setExpandedServer(
                  expandedServer === server.name ? null : server.name
                )
              }
            >
              <div className="gs-row">
                <div
                  className={`${
 server.status === 'active'
 ? 'bg-green-500'
 : server.status === 'error'
 ? 'bg-red-500'
 : 'bg-gray-300'
 }`}
                ></div>
                <div>
                  <h3>{server.name}</h3>
                  <p className="gs-text-subtle">{server.description}</p>
                  {server.lastActive && (
                    <p className="gs-cell-meta">
                      Last active: {new Date(server.lastActive).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown
                className={`gs-icon gs-icon--lg transition-transform ${
 expandedServer === server.name ? 'rotate-180' : ''
 }`}
              />
            </div>

            {expandedServer === server.name && (
              <div className="gs-stack-sm">
                {server.status === 'error' && server.errorMessage && (
                  <div className="gs-alert gs-alert--error">
                    {server.errorMessage}
                  </div>
                )}

                <div>
                  <h4>
                    Available Tools ({server.tools.length})
                  </h4>
                  <div className="gs-input-group">
                    {server.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="gs-panel"
                        onClick={() => {
                          setSelectedServer(server.name);
                          setSelectedTool(tool.name);
                        }}
                      >
                        <div className="gs-mono">
                          {tool.name}
                        </div>
                        <p className="gs-text-subtle">
                          {tool.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedServer === server.name && selectedTool && (
                  <div className="gs-alert gs-alert--info gs-input-group">
                    <div className="gs-row gs-row--between">
                      <div>
                        <p>
                          Execute: {selectedTool}
                        </p>
                      </div>
                      <button
                        onClick={() => executeTool(server.name, selectedTool)}
                        disabled={isExecuting}
                        className="gs-button"
                      >
                        {isExecuting ? (
                          <Loader className="gs-icon gs-spin" />
                        ) : (
                          <Play className="gs-icon" />
                        )}
                        Execute
                      </button>
                    </div>

                    {executionResult && (
                      <div className="gs-mono">
                        <pre>{executionResult}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}

      <div className="gs-alert gs-alert--info">
        <h4>
          <CheckCircle className="gs-icon gs-icon--lg gs-icon--inline" />
          Available Servers
        </h4>
        <ul className="gs-input-group gs-list-tight">
          <li>GitHub PR Manager - Automate PR management and CI/CD</li>
          <li>Email Mailbox Manager - Send campaigns and manage templates</li>
          <li>Cloudflare Config Sync - Sync and verify infrastructure</li>
        </ul>
      </div>
    </div>
  );
}
