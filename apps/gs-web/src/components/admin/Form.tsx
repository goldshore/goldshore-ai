import React, { ReactNode, useState } from 'react';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  value?: string | number;
}

interface FormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
  submitLabel?: string;
  loading?: boolean;
  error?: string;
  children?: ReactNode;
}

export function Form({
  fields,
  onSubmit,
  submitLabel = 'Submit',
  loading = false,
  error,
  children,
}: FormProps) {
  const [values, setValues] = useState<Record<string, string | number>>(
    fields.reduce((acc, field) => ({ ...acc, [field.name]: field.value || '' }), {})
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="gs-stack">
      {error && <div className="gs-alert gs-alert--error" role="alert">{error}</div>}
      {submitError && (
        <div className="gs-alert gs-alert--error" role="alert">
          {submitError}
        </div>
      )}

      <div className="gs-stack-sm">
        {fields.map((field) => (
          <div key={field.name} className="gs-field">
            <label htmlFor={field.name} className="gs-label">
              {field.label}
              {field.required && <span className="gs-required">*</span>}
            </label>

            {field.type === 'textarea' ? (
              <textarea
                id={field.name}
                name={field.name}
                value={values[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
                rows={4}
              />
            ) : field.type === 'select' ? (
              <select
                id={field.name}
                name={field.name}
                value={values[field.name]}
                onChange={handleChange}
                required={field.required}
              >
                <option value="">Select {field.label}</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={field.name}
                type={field.type}
                name={field.name}
                value={values[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}
          </div>
        ))}
      </div>

      {children}

      <button
        type="submit"
        disabled={isSubmitting || loading}
        className="gs-button gs-button--block"
      >
        {isSubmitting || loading ? 'Submitting...' : submitLabel}
      </button>
    </form>
  );
}
