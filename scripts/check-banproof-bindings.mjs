import fs from 'node:fs';
import path from 'node:path';

const wranglerPath = path.resolve('apps/banproof-me/wrangler.toml');
const required = {
  d1: { binding: 'PLATFORM_DB', database_name: 'gs_platform_db' },
  kv_namespaces: ['BANPROOF_KV', 'AI_CACHE'],
  queues: ['BANPROOF_JOBS'],
  services: [{ binding: 'GS_API', service: 'gs-api' }],
  secrets: ['OPENAI_API_KEY', 'POA_TOKEN', 'AUDIT_TOKEN'],
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getProdSection(toml) {
  const prodHeader = /^\[env\.prod\]\s*$/m;
  const headerMatch = prodHeader.exec(toml);
  if (!headerMatch) {
    return null;
  }

  const start = headerMatch.index + headerMatch[0].length;
  const rest = toml.slice(start);
  const nextSectionMatch = /^\[env\.(?!prod\])[\w.-]+\]\s*$/m.exec(rest);
  const end = nextSectionMatch ? start + nextSectionMatch.index : toml.length;
  return toml.slice(start, end);
}

function hasKeyValue(section, key, value) {
  const pattern = new RegExp(
    String.raw`(^|\n)\s*${escapeRegExp(key)}\s*=\s*(['"])${escapeRegExp(value)}\2(?=\s*(#.*)?(?:\n|$))`,
    'm',
  );
  return pattern.test(section);
}

function hasSecretName(section, secretName) {
  const pattern = new RegExp(
    String.raw`(^|\n)\s*(?:secret|name|binding)\s*=\s*(['"])${escapeRegExp(secretName)}\2(?=\s*(#.*)?(?:\n|$))`,
    'm',
  );
  return pattern.test(section) || section.includes(secretName);
}

const errors = [];
if (!fs.existsSync(wranglerPath)) {
  errors.push(`Missing required Wrangler file: ${wranglerPath}`);
} else {
  const wrangler = fs.readFileSync(wranglerPath, 'utf8');
  const prodSection = getProdSection(wrangler);

  if (!prodSection) {
    errors.push('Missing required [env.prod] section in Wrangler file.');
  } else {
    if (!hasKeyValue(prodSection, 'binding', required.d1.binding)) {
      errors.push(`Missing or renamed required production D1 binding: ${required.d1.binding}`);
    }
    if (!hasKeyValue(prodSection, 'database_name', required.d1.database_name)) {
      errors.push(`Missing or renamed required production D1 database_name: ${required.d1.database_name}`);
    }

    for (const key of required.kv_namespaces) {
      if (!hasKeyValue(prodSection, 'binding', key)) {
        errors.push(`Missing or renamed required production KV binding: ${key}`);
      }
    }

    for (const key of required.queues) {
      if (!hasKeyValue(prodSection, 'binding', key)) {
        errors.push(`Missing or renamed required production queue binding: ${key}`);
      }
    }

    for (const svc of required.services) {
      const servicePattern = new RegExp(
        String.raw`\[\[\s*env\.prod\.services\s*\]\][\s\S]*?^\s*binding\s*=\s*(['"])${escapeRegExp(svc.binding)}\1[\s\S]*?^\s*service\s*=\s*(['"])${escapeRegExp(svc.service)}\2`,
        'm',
      );
      if (!servicePattern.test(prodSection)) {
        errors.push(
          `Missing or renamed required production service binding: ${svc.binding} -> ${svc.service}`,
        );
      }
    }

    for (const key of required.secrets) {
      if (!hasSecretName(prodSection, key)) {
        errors.push(`Missing or renamed required production secret: ${key}`);
      }
    }
  }
}

if (errors.length) {
  console.error('banproof-me production binding validation failed:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log('banproof-me production binding validation passed.');
