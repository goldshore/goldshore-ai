import type { JsonPropertySchema, JsonValue, StrictJsonSchema } from './types';

const error = (path: string, message: string): never => { throw new Error(`Invalid JSON at ${path}: ${message}`); };

function validateProperty(value: unknown, schema: JsonPropertySchema, path: string): JsonValue {
  if (schema.type === 'object') return validateStrictJson(value, schema, path);
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return error(path, 'expected array');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return error(path, 'too many items');
    return value.map((item, index) => validateProperty(item, schema.items, `${path}[${index}]`));
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return error(path, 'expected string');
    if (schema.enum && !schema.enum.includes(value)) return error(path, 'not in enum');
    if (schema.minLength !== undefined && value.length < schema.minLength) return error(path, 'too short');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return error(path, 'too long');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) return error(path, 'pattern mismatch');
    return value;
  }
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') return error(path, 'expected boolean');
    return value;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return error(path, 'expected number');
  if (schema.type === 'integer' && !Number.isInteger(value)) return error(path, 'expected integer');
  if (schema.minimum !== undefined && value < schema.minimum) return error(path, 'below minimum');
  if (schema.maximum !== undefined && value > schema.maximum) return error(path, 'above maximum');
  return value;
}

export function validateStrictJson(value: unknown, schema: StrictJsonSchema, path = '$'): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return error(path, 'expected object');
  const candidate = value as Record<string, unknown>;
  for (const key of Object.keys(candidate)) if (!(key in schema.properties)) error(`${path}.${key}`, 'additional property');
  for (const key of schema.required) if (!(key in candidate)) error(`${path}.${key}`, 'required property missing');
  return Object.fromEntries(Object.entries(candidate).map(([key, item]) => [key, validateProperty(item, schema.properties[key], `${path}.${key}`)]));
}
