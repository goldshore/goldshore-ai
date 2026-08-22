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
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {servers.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          No MCP servers available. Ensure servers are configured and running.
        </div>
      ) : (
        servers.map((server) => (
          <div
            key={server.name}
            className="border rounded-lg overflow-hidden bg-white shadow-sm"
          >
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
              onClick={() =>
                setExpandedServer(
                  expandedServer === server.name ? null : server.name
                )
              }
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-3 h-3 rounded-full ${
                    server.status === 'active'
                      ? 'bg-green-500'
                      : server.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-gray-300'
                  }`}
                ></div>
                <div>
                  <h3 className="font-semibold text-gray-900">{server.name}</h3>
                  <p className="text-sm text-gray-600">{server.description}</p>
                  {server.lastActive && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last active: {new Date(server.lastActive).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedServer === server.name ? 'rotate-180' : ''
                }`}
              />
            </div>

            {expandedServer === server.name && (
              <div className="bg-gray-50 border-t p-4 space-y-4">
                {server.status === 'error' && server.errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {server.errorMessage}
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Available Tools ({server.tools.length})
                  </h4>
                  <div className="space-y-2">
                    {server.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="p-3 bg-white border rounded hover:border-blue-300 cursor-pointer"
                        onClick={() => {
                          setSelectedServer(server.name);
                          setSelectedTool(tool.name);
                        }}
                      >
                        <div className="font-mono text-sm text-blue-600 font-medium">
                          {tool.name}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {tool.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedServer === server.name && selectedTool && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Execute: {selectedTool}
                        </p>
                      </div>
                      <button
                        onClick={() => executeTool(server.name, selectedTool)}
                        disabled={isExecuting}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {isExecuting ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Execute
                      </button>
                    </div>

                    {executionResult && (
                      <div className="mt-3 p-2 bg-gray-900 text-green-400 font-mono text-xs rounded overflow-auto max-h-48">
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

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">
          <CheckCircle className="w-5 h-5 inline mr-2" />
          Available Servers
        </h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>GitHub PR Manager - Automate PR management and CI/CD</li>
          <li>Email Mailbox Manager - Send campaigns and manage templates</li>
          <li>Cloudflare Config Sync - Sync and verify infrastructure</li>
        </ul>
      </div>
    </div>
  );
}
