import React, { useState, useEffect, useCallback } from 'react';
import { PanelLayout, PanelConfig } from './PanelLayout';
import { CommandPalette, type Command } from './CommandPalette';
import { Panel } from './Panel';
import EmailTemplateEditor from './EmailTemplateEditor';
import SecretCreator from './SecretCreator';
import APIKeyRotator from './APIKeyRotator';
import EmailManager from './EmailManager';
import EntriesManager from './EntriesManager';
import UsersManager from './UsersManager';
import SettingsManager from './SettingsManager';

interface IDEDashboardProps {
  jwtToken: string;
}

export default function IDEDashboard({ jwtToken }: IDEDashboardProps) {
  const [panels, setPanels] = useState<PanelConfig[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Initialize default panels
  useEffect(() => {
    const savedPanels = localStorage.getItem('admin-panel-layout');
    if (!savedPanels) {
      setPanels([
        {
          id: 'welcome',
          title: 'Welcome to IDE Dashboard',
          icon: '👋',
          x: 20,
          y: 20,
          width: 400,
          height: 300,
          minWidth: 300,
          minHeight: 200,
          zIndex: 100,
          content: (
            <div className="gs-welcome-panel">
              <p>Phase 2 IDE-like Admin Dashboard</p>
              <ul>
                <li>Press <kbd>⌘K</kbd> to open command palette</li>
                <li>Drag panels to move them around</li>
                <li>Resize panels by dragging corners</li>
                <li>Double-click title bar to collapse</li>
                <li>Layout automatically saves</li>
              </ul>
            </div>
          )
        }
      ]);
    }
  }, []);

  const addPanel = useCallback((panelConfig: Omit<PanelConfig, 'x' | 'y' | 'width' | 'height' | 'minWidth' | 'minHeight' | 'zIndex'>) => {
    const newPanel: PanelConfig = {
      ...panelConfig,
      x: Math.random() * 200 + 20,
      y: Math.random() * 200 + 20,
      width: 500,
      height: 400,
      minWidth: 300,
      minHeight: 200,
      zIndex: Math.max(...panels.map(p => p.zIndex), 100) + 1
    };
    setPanels([...panels, newPanel]);
  }, [panels]);

  const commands: Command[] = [
    {
      id: 'email-template',
      label: 'Email Template Editor',
      icon: '✉️',
      category: 'Content',
      description: 'Create and edit WYSIWYG email templates',
      action: () => {
        addPanel({
          id: `email-template-${Date.now()}`,
          title: 'Email Template Editor',
          icon: '✉️',
          content: <EmailTemplateEditor onCancel={() => {}} />
        });
        setCommandPaletteOpen(false);
      },
      keywords: ['email', 'template', 'wysiwyg', 'editor']
    },
    {
      id: 'secret-creator',
      label: 'Create Secret',
      icon: '🔐',
      category: 'Security',
      description: 'Create and manage API keys and secrets',
      action: () => {
        addPanel({
          id: `secret-creator-${Date.now()}`,
          title: 'Create New Secret',
          icon: '🔐',
          content: <SecretCreator onCancel={() => {}} />
        });
        setCommandPaletteOpen(false);
      },
      keywords: ['secret', 'api', 'key', 'credentials']
    },
    {
      id: 'api-rotator',
      label: 'API Key Management',
      icon: '🔄',
      category: 'Security',
      description: 'Rotate and revoke API keys',
      action: () => {
        addPanel({
          id: `api-rotator-${Date.now()}`,
          title: 'API Key Management',
          icon: '🔄',
          content: <APIKeyRotator keys={[]} />
        });
        setCommandPaletteOpen(false);
      },
      keywords: ['rotate', 'revoke', 'api', 'key']
    },
    {
      id: 'email-manager',
      label: 'Email Management',
      icon: '📧',
      category: 'Operations',
      description: 'View and manage email logs',
      action: () => {
        addPanel({
          id: `email-manager-${Date.now()}`,
          title: 'Email Management',
          icon: '📧',
          content: (
            <EmailManager
              jwtToken={jwtToken}
              initialLogs={{ items: [], total: 0, offset: 0, limit: 25 }}
            />
          )
        });
        setCommandPaletteOpen(false);
      },
      keywords: ['email', 'logs', 'delivery', 'queue']
    },
    {
      id: 'entries',
      label: 'Entries & Forms',
      icon: '📝',
      category: 'Operations',
      description: 'Manage contact and lead submissions',
      action: () => {
        addPanel({
          id: `entries-${Date.now()}`,
          title: 'Entries Manager',
          icon: '📝',
          content: (
            <EntriesManager
              jwtToken={jwtToken}
              initialEntries={{ items: [], total: 0, offset: 0, limit: 25 }}
            />
          )
        });
        setCommandPaletteOpen(false);
      },
      keywords: ['entries', 'contacts', 'leads', 'forms']
    },
    {
      id: 'users',
      label: 'Team Management',
      icon: '👥',
      category: 'Operations',
      description: 'Manage admin users and permissions',
      action: () => {
        addPanel({
          id: `users-${Date.now()}`,
          title: 'Users Manager',
          icon: '👥',
          content: (
            <UsersManager
              jwtToken={jwtToken}
              initialUsers={{ items: [], total: 0, offset: 0, limit: 25 }}
            />
          )
        });
        setCommandPaletteOpen(false);
      },
      keywords: ['users', 'team', 'admin', 'permissions']
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      category: 'Configuration',
      description: 'Global configuration and settings',
      action: () => {
        addPanel({
          id: `settings-${Date.now()}`,
          title: 'Settings',
          icon: '⚙️',
          content: <SettingsManager jwtToken={jwtToken} initialSettings={{}} />
        });
        setCommandPaletteOpen(false);
      },
      keywords: ['settings', 'config', 'configuration']
    },
    {
      id: 'clear-panels',
      label: 'Clear All Panels',
      icon: '🗑️',
      category: 'View',
      description: 'Close all open panels',
      action: () => {
        setPanels([]);
        setCommandPaletteOpen(false);
      },
      keywords: ['clear', 'close', 'reset']
    },
    {
      id: 'reset-layout',
      label: 'Reset Layout',
      icon: '↺',
      category: 'View',
      description: 'Reset panel layout to default',
      action: () => {
        localStorage.removeItem('admin-panel-layout');
        setPanels([]);
        setCommandPaletteOpen(false);
      },
      keywords: ['reset', 'default', 'layout']
    }
  ];

  return (
    <div className="gs-ide-dashboard">
      <PanelLayout
        panels={panels}
        onPanelsChange={setPanels}
        storageKey="admin-panel-layout"
      />

      <CommandPalette
        commands={commands}
        isOpen={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      <style>{`
        .gs-ide-dashboard {
          width: 100%;
          height: 100%;
          position: relative;
          background: var(--admin-bg);
        }

        .gs-welcome-panel {
          color: var(--admin-text);
        }

        .gs-welcome-panel p {
          font-size: 14px;
          margin: 0 0 16px;
          color: var(--admin-accent);
          font-weight: 600;
        }

        .gs-welcome-panel ul {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 13px;
          line-height: 1.8;
        }

        .gs-welcome-panel li {
          color: var(--admin-muted);
          margin-bottom: 8px;
        }

        .gs-welcome-panel kbd {
          background: rgba(224, 139, 72, 0.1);
          border: 1px solid rgba(224, 139, 72, 0.3);
          color: var(--admin-accent);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 11px;
          margin: 0 2px;
        }
      `}</style>
    </div>
  );
}
