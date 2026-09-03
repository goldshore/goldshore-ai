import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import { analyzeSql, splitSqlStatements } from '../lib/sql-sync';
import sqlSync from './admin/sql-sync';
import type { Env, Variables } from '../types';

describe('HostGator SQL sync safeguards', () => {
  it('splits quoted semicolons and classifies statement risk', () => {
    const statements = splitSqlStatements("INSERT INTO notes(body) VALUES('a;b'); ALTER TABLE notes ADD INDEX idx_body(body);");
    assert.equal(statements.length, 2);
    const analysis = analyzeSql(statements.join(';'));
    assert.deepEqual(analysis.counts, { read: 0, data: 1, schema: 1, destructive: 0 });
  });
  it('flags destructive SQL and rejects credential or file administration', () => {
    assert.equal(analyzeSql('DROP TABLE old_data;').destructive, true);
    assert.throws(() => analyzeSql("CREATE USER 'bad'@'%' IDENTIFIED BY 'secret';"), /forbidden/i);
    assert.throws(() => analyzeSql("SELECT * INTO OUTFILE '/tmp/a' FROM users;"), /forbidden/i);
  });
  it('denies SQL plan creation to viewers before reading storage', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => { c.set('accessClaims', { roles: ['viewer'], email: 'viewer@goldshore.ai' }); await next(); });
    app.route('/admin', sqlSync);
    const response = await app.request('/admin/sql-sync/plans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, {} as Env);
    assert.equal(response.status, 403);
  });
  it('refuses execution when Hyperdrive is absent', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => { c.set('accessClaims', { roles: ['owner'], email: 'owner@goldshore.ai' }); await next(); });
    app.route('/admin', sqlSync);
    const response = await app.request('/admin/sql-sync/plans/plan-1/execute', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, {} as Env);
    assert.equal(response.status, 503);
    assert.match(await response.text(), /No SQL was executed/);
  });
});
