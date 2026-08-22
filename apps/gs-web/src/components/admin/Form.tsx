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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-sm font-medium mb-2">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
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
                className="w-full px-3 py-2 text-sm border rounded gs-input"
              />
            ) : field.type === 'select' ? (
              <select
                id={field.name}
                name={field.name}
                value={values[field.name]}
                onChange={handleChange}
                required={field.required}
                className="w-full px-3 py-2 text-sm border rounded gs-input"
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
                className="w-full px-3 py-2 text-sm border rounded gs-input"
              />
            )}
          </div>
        ))}
      </div>

      {children}

      <button
        type="submit"
        disabled={isSubmitting || loading}
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting || loading ? 'Submitting...' : submitLabel}
      </button>
    </form>
  );
}
