export type SqlRisk = 'read' | 'data' | 'schema' | 'destructive';
export type SqlStatement = { index: number; sql: string; kind: string; risk: SqlRisk };
const forbidden = /\b(?:GRANT|REVOKE|CREATE\s+USER|ALTER\s+USER|DROP\s+USER|INTO\s+OUTFILE|LOAD\s+DATA|LOAD_FILE|INSTALL\s+PLUGIN|UNINSTALL\s+PLUGIN|CREATE\s+(?:PROCEDURE|FUNCTION|TRIGGER|EVENT))\b/i;
const destructive = /^(?:DROP|TRUNCATE|DELETE|REPLACE)\b/i;
const schema = /^(?:CREATE|ALTER|RENAME)\b/i;
const data = /^(?:INSERT|UPDATE)\b/i;
const read = /^(?:SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b/i;

export const splitSqlStatements = (input: string) => {
  const statements: string[] = []; let current = ''; let quote = ''; let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]; const next = input[i + 1];
    if (!quote && char === '-' && next === '-') { while (i < input.length && input[i] !== '\n') i += 1; current += '\n'; continue; }
    if (!quote && char === '/' && next === '*') { i += 2; while (i < input.length - 1 && !(input[i] === '*' && input[i + 1] === '/')) i += 1; i += 1; continue; }
    current += char;
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && quote) { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === ';') { const value = current.slice(0, -1).trim(); if (value) statements.push(value); current = ''; }
  }
  if (quote) throw new Error('Unterminated SQL string or identifier.');
  const tail = current.trim(); if (tail) statements.push(tail); return statements;
};

export const analyzeSql = (input: string) => {
  if (!input.trim() || input.length > 500_000) throw new Error('SQL must be between 1 and 500000 characters.');
  const raw = splitSqlStatements(input); if (!raw.length || raw.length > 100) throw new Error('SQL plans support 1 to 100 statements.');
  const statements: SqlStatement[] = raw.map((sql, index) => {
    if (forbidden.test(sql)) throw new Error(`Statement ${index + 1} uses a forbidden administrative or file operation.`);
    const kind = sql.match(/^([A-Za-z]+)/)?.[1]?.toUpperCase() ?? 'UNKNOWN';
    const risk: SqlRisk = destructive.test(sql) ? 'destructive' : schema.test(sql) ? 'schema' : data.test(sql) ? 'data' : read.test(sql) ? 'read' : (() => { throw new Error(`Statement ${index + 1} is not in the supported SQL allowlist.`); })();
    return { index: index + 1, sql, kind, risk };
  });
  return { statements, counts: { read: statements.filter((s) => s.risk === 'read').length, data: statements.filter((s) => s.risk === 'data').length, schema: statements.filter((s) => s.risk === 'schema').length, destructive: statements.filter((s) => s.risk === 'destructive').length }, destructive: statements.some((s) => s.risk === 'destructive') };
};

export const sha256 = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
