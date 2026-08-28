import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import AuthGuard from './AuthGuard';
import { useAuthToken } from '../../utils/auth';
import EmailTemplateEditor from './EmailTemplateEditor';

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  html_body?: string;
  category: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

interface Props {
  jwtToken?: string;
  initialTemplates?: { items: Template[] };
}

function EmailTemplatesContent({ jwtToken: _jwtToken }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdvancedEditorOpen, setIsAdvancedEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    htmlBody: '',
    category: 'transactional',
    variables: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { token } = useAuthToken();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/admin/email/templates', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.items || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    }
  };

  const handleCreateTemplate = async () => {
    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!formData.subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!formData.body.trim()) {
      setError('Template body is required');
      return;
    }

    setIsSaving(true);
    try {
      const variables = formData.variables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const response = await fetch('/api/admin/email/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formData.name,
          subject: formData.subject,
          body: formData.body,
          htmlBody: formData.htmlBody || undefined,
          category: formData.category,
          variables,
        }),
      });

      if (response.ok) {
        setSuccess('Template created successfully');
        setFormData({
          name: '',
          subject: '',
          body: '',
          htmlBody: '',
          category: 'transactional',
          variables: '',
        });
        setTimeout(() => {
          setIsCreateModalOpen(false);
          loadTemplates();
        }, 500);
      } else if (response.status === 401) {
        setError('Authentication expired. Please refresh the page.');
      } else {
        const err = await response.json().catch(() => ({}));
        setError(err.error || 'Failed to create template');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      htmlBody: template.html_body || '',
      category: template.category,
      variables: template.variables?.join(', ') || '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return;

    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!formData.subject.trim()) {
      setError('Subject is required');
      return;
    }

    setIsSaving(true);
    try {
      const variables = formData.variables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const response = await fetch(`/api/admin/email/templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formData.name,
          subject: formData.subject,
          body: formData.body,
          htmlBody: formData.htmlBody || undefined,
          category: formData.category,
          variables,
        }),
      });

      if (response.ok) {
        setSuccess('Template updated successfully');
        setIsEditModalOpen(false);
        setSelectedTemplate(null);
        loadTemplates();
      } else if (response.status === 401) {
        setError('Authentication expired. Please refresh the page.');
      } else {
        const err = await response.json().catch(() => ({}));
        setError(err.error || 'Failed to update template');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/email/templates/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        setSuccess('Template deleted successfully');
        loadTemplates();
      } else {
        setError('Failed to delete template');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const handleAdvancedEditorSave = async (editorTemplate: any) => {
    setError(null);
    setSuccess(null);

    if (!editorTemplate.name?.trim()) {
      setError('Template name is required');
      return;
    }

    if (!editorTemplate.subject?.trim()) {
      setError('Subject is required');
      return;
    }

    setIsSaving(true);
    try {
      const isUpdating = selectedTemplate !== null;
      const endpoint = isUpdating
        ? `/api/admin/email/templates/${selectedTemplate.id}`
        : '/api/admin/email/templates';
      const method = isUpdating ? 'PUT' : 'POST';

      const variables = formData.variables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: editorTemplate.name,
          subject: editorTemplate.subject,
          body: editorTemplate.textContent || editorTemplate.htmlContent,
          htmlBody: editorTemplate.htmlContent,
          category: formData.category,
          variables,
        }),
      });

      if (response.ok) {
        setSuccess(`Template ${isUpdating ? 'updated' : 'created'} successfully`);
        setIsAdvancedEditorOpen(false);
        setTimeout(() => {
          loadTemplates();
        }, 500);
      } else if (response.status === 401) {
        setError('Authentication expired. Please refresh the page.');
      } else {
        const err = await response.json().catch(() => ({}));
        setError(err.error || `Failed to ${isUpdating ? 'update' : 'create'} template`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${selectedTemplate ? 'update' : 'create'} template`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="gs-stack">
      <div className="gs-row gs-row--between">
        <h2>Email Templates</h2>
        <div className="gs-row">
          <button
            onClick={() => {
              setSelectedTemplate(null);
              setFormData({
                name: '',
                subject: '',
                body: '',
                htmlBody: '',
                category: 'transactional',
                variables: '',
              });
              setIsCreateModalOpen(true);
            }}
            className="gs-button"
          >
            + Create Template
          </button>
          <button
            onClick={() => {
              setSelectedTemplate(null);
              setFormData({
                name: '',
                subject: '',
                body: '',
                htmlBody: '',
                category: 'transactional',
                variables: '',
              });
              setIsAdvancedEditorOpen(true);
            }}
            className="gs-button"
          >
            + WYSIWYG Editor
          </button>
        </div>
      </div>

      {error && (
        <div className="gs-alert gs-alert--error">
          {error}
        </div>
      )}

      {success && (
        <div className="gs-alert gs-alert--success">
          {success}
        </div>
      )}

      <div>
        {templates.length === 0 ? (
          <div className="gs-card">
            <p className="gs-text-subtle">No templates created yet. Create your first template to get started.</p>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="gs-card gs-row gs-row--between">
              <div>
                <h3>{template.name}</h3>
                <p className="gs-text-subtle">{template.subject}</p>
                <div className="gs-row">
                  <span className="gs-badge">
                    {template.category}
                  </span>
                  {template.variables && template.variables.length > 0 && (
                    <span className="gs-badge">
                      {template.variables.length} variables
                    </span>
                  )}
                </div>
              </div>
              <div className="gs-row">
                <button
                  onClick={() => handleEditTemplate(template)}
                  className="gs-link-button"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setFormData({
                      name: template.name,
                      subject: template.subject,
                      body: template.body,
                      htmlBody: template.html_body || '',
                      category: template.category,
                      variables: template.variables?.join(', ') || '',
                    });
                    setIsAdvancedEditorOpen(true);
                  }}
                  className="gs-link-button"
                >
                  WYSIWYG
                </button>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="gs-link-button gs-link-button--danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setError(null);
          setSuccess(null);
        }}
        title="Create Email Template"
        onSubmit={handleCreateTemplate}
        isLoading={isSaving}
      >
        {error && (
          <div className="gs-alert gs-alert--error">
            {error}
          </div>
        )}
        {success && (
          <div className="gs-alert gs-alert--success">
            {success}
          </div>
        )}
        <FormField
          label="Template Name"
          name="name"
          value={formData.name}
          onChange={(v) => setFormData({ ...formData, name: String(v) })}
          placeholder="e.g., Welcome Email"
          required
        />
        <FormField
          label="Category"
          name="category"
          type="select"
          value={formData.category}
          onChange={(v) => setFormData({ ...formData, category: String(v) })}
          options={[
            { value: 'transactional', label: 'Transactional' },
            { value: 'marketing', label: 'Marketing' },
            { value: 'notification', label: 'Notification' },
            { value: 'campaign', label: 'Campaign' },
          ]}
        />
        <FormField
          label="Subject Line"
          name="subject"
          value={formData.subject}
          onChange={(v) => setFormData({ ...formData, subject: String(v) })}
          placeholder="Email subject"
          required
        />
        <FormField
          label="Email Body (Plain Text)"
          name="body"
          type="textarea"
          value={formData.body}
          onChange={(v) => setFormData({ ...formData, body: String(v) })}
          placeholder="Email body content"
          required
        />
        <FormField
          label="HTML Body (Optional)"
          name="htmlBody"
          type="textarea"
          value={formData.htmlBody}
          onChange={(v) => setFormData({ ...formData, htmlBody: String(v) })}
          placeholder="HTML formatted email body"
        />
        <FormField
          label="Variables (Comma-separated)"
          name="variables"
          value={formData.variables}
          onChange={(v) => setFormData({ ...formData, variables: String(v) })}
          placeholder="e.g., firstName, lastName, confirmationUrl"
        />
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTemplate(null);
          setError(null);
          setSuccess(null);
        }}
        title={`Edit Template: ${selectedTemplate?.name}`}
        onSubmit={handleUpdateTemplate}
        isLoading={isSaving}
      >
        {error && (
          <div className="gs-alert gs-alert--error">
            {error}
          </div>
        )}
        {success && (
          <div className="gs-alert gs-alert--success">
            {success}
          </div>
        )}
        <FormField
          label="Template Name"
          name="name"
          value={formData.name}
          onChange={(v) => setFormData({ ...formData, name: String(v) })}
          placeholder="e.g., Welcome Email"
          required
        />
        <FormField
          label="Category"
          name="category"
          type="select"
          value={formData.category}
          onChange={(v) => setFormData({ ...formData, category: String(v) })}
          options={[
            { value: 'transactional', label: 'Transactional' },
            { value: 'marketing', label: 'Marketing' },
            { value: 'notification', label: 'Notification' },
            { value: 'campaign', label: 'Campaign' },
          ]}
        />
        <FormField
          label="Subject Line"
          name="subject"
          value={formData.subject}
          onChange={(v) => setFormData({ ...formData, subject: String(v) })}
          placeholder="Email subject"
          required
        />
        <FormField
          label="Email Body (Plain Text)"
          name="body"
          type="textarea"
          value={formData.body}
          onChange={(v) => setFormData({ ...formData, body: String(v) })}
          placeholder="Email body content"
          required
        />
        <FormField
          label="HTML Body (Optional)"
          name="htmlBody"
          type="textarea"
          value={formData.htmlBody}
          onChange={(v) => setFormData({ ...formData, htmlBody: String(v) })}
          placeholder="HTML formatted email body"
        />
        <FormField
          label="Variables (Comma-separated)"
          name="variables"
          value={formData.variables}
          onChange={(v) => setFormData({ ...formData, variables: String(v) })}
          placeholder="e.g., firstName, lastName, confirmationUrl"
        />
      </Modal>

      {isAdvancedEditorOpen && (
        <div className="gs-row bg-opacity-50">
          <div className="max-w-4xl">
            <div>
              {error && (
                <div className="gs-alert gs-alert--error">
                  {error}
                </div>
              )}
              {success && (
                <div className="gs-alert gs-alert--success">
                  {success}
                </div>
              )}
              <EmailTemplateEditor
                template={{
                  id: selectedTemplate?.id,
                  name: formData.name,
                  subject: formData.subject,
                  textContent: formData.body,
                  htmlContent: formData.htmlBody || formData.body,
                  variables: formData.variables.split(',').map(v => v.trim()).filter(Boolean),
                }}
                onSave={(template) => {
                  handleAdvancedEditorSave(template);
                }}
                onCancel={() => {
                  setIsAdvancedEditorOpen(false);
                  setSelectedTemplate(null);
                  setError(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmailTemplatesManager(props: Props) {
  return (
    <AuthGuard>
      <EmailTemplatesContent {...props} />
    </AuthGuard>
  );
}
