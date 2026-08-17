import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables?: string[];
  tags?: string[];
}

interface EmailTemplateEditorProps {
  template?: EmailTemplate;
  onSave?: (template: EmailTemplate) => void;
  onCancel?: () => void;
}

const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  template = {
    name: '',
    subject: '',
    htmlContent: '',
    textContent: '',
    variables: [],
    tags: []
  },
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<EmailTemplate>(template);
  const [activeTab, setActiveTab] = useState<'visual' | 'html' | 'preview'>('visual');
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (field: keyof EmailTemplate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulated save
      onSave?.(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    const updatedContent = formData.htmlContent + `{{${variable}}}`;
    handleInputChange('htmlContent', updatedContent);
  };

  const handleFormatText = (style: 'bold' | 'italic' | 'link') => {
    const selection = window.getSelection();
    if (!selection?.toString()) return;

    const selected = selection.toString();
    let formatted = '';

    switch (style) {
      case 'bold':
        formatted = `<strong>${selected}</strong>`;
        break;
      case 'italic':
        formatted = `<em>${selected}</em>`;
        break;
      case 'link':
        formatted = `<a href="https://">${selected}</a>`;
        break;
    }

    const updatedContent = formData.htmlContent.replace(selected, formatted);
    handleInputChange('htmlContent', updatedContent);
  };

  return (
    <motion.div
      className="gs-email-editor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="gs-editor-header">
        <input
          type="text"
          placeholder="Template name (e.g., Welcome Email)"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="gs-template-name-input"
        />
        <input
          type="text"
          placeholder="Email subject line"
          value={formData.subject}
          onChange={(e) => handleInputChange('subject', e.target.value)}
          className="gs-template-subject-input"
        />
      </div>

      {/* Tab Navigation */}
      <div className="gs-editor-tabs">
        {(['visual', 'html', 'preview'] as const).map(tab => (
          <button
            key={tab}
            className={`gs-editor-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'visual' && '✏️ Visual'}
            {tab === 'html' && '</> HTML'}
            {tab === 'preview' && '👁️ Preview'}
          </button>
        ))}
      </div>

      {/* Editor Area */}
      <div className="gs-editor-content">
        {activeTab === 'visual' && (
          <div className="gs-visual-editor">
            {/* Toolbar */}
            <div className="gs-editor-toolbar">
              <button
                onClick={() => handleFormatText('bold')}
                className="gs-editor-tool"
                title="Bold"
              >
                <strong>B</strong>
              </button>
              <button
                onClick={() => handleFormatText('italic')}
                className="gs-editor-tool"
                title="Italic"
              >
                <em>I</em>
              </button>
              <button
                onClick={() => handleFormatText('link')}
                className="gs-editor-tool"
                title="Link"
              >
                🔗
              </button>
              <div className="gs-toolbar-divider" />
              <select
                className="gs-editor-select"
                onChange={(e) => insertVariable(e.target.value)}
                defaultValue=""
              >
                <option value="">Insert variable...</option>
                <option value="user_name">User Name</option>
                <option value="user_email">User Email</option>
                <option value="company_name">Company Name</option>
                <option value="activation_link">Activation Link</option>
                <option value="support_email">Support Email</option>
              </select>
            </div>

            {/* Visual Canvas */}
            <div
              ref={editorRef}
              className="gs-visual-canvas"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => handleInputChange('htmlContent', e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: formData.htmlContent || '<p>Start typing your email content here...</p>' }}
            />
          </div>
        )}

        {activeTab === 'html' && (
          <textarea
            className="gs-html-editor"
            value={formData.htmlContent}
            onChange={(e) => handleInputChange('htmlContent', e.target.value)}
            placeholder="Enter HTML email content"
            spellCheck="false"
          />
        )}

        {activeTab === 'preview' && (
          <div className="gs-preview-container">
            <div className="gs-preview-header">
              <p><strong>Subject:</strong> {formData.subject || '(No subject)'}</p>
            </div>
            <div
              className="gs-preview-content"
              dangerouslySetInnerHTML={{ __html: formData.htmlContent || '<p>No content</p>' }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="gs-editor-footer">
        <div className="gs-tag-input">
          <input
            type="text"
            placeholder="Add tags (comma-separated)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const tags = e.currentTarget.value.split(',').map(t => t.trim());
                handleInputChange('tags', [...(formData.tags || []), ...tags]);
                e.currentTarget.value = '';
              }
            }}
          />
        </div>

        <div className="gs-editor-actions">
          {onCancel && (
            <button
              onClick={onCancel}
              className="gs-btn gs-btn-outline"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !formData.name}
            className="gs-btn gs-btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default EmailTemplateEditor;
