import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildServer } from '../src/server.js';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TEST_DATA_DIR = join(__dirname, 'temp-data');

describe('API Mutant Routes Audit (Postgres/SQLite Version)', () => {
  let app: any;

  before(async () => {
    await mkdir(TEST_DATA_DIR, { recursive: true });
    
    const config = {
      host: 'localhost',
      port: 0,
      scraperBaseUrl: 'http://localhost:4541',
    };
    
    app = await buildServer(config);
  });

  after(async () => {
    if (app) await app.close();
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  test('POST /api/downloads - should return standardized error for invalid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/downloads',
      payload: { url: 'not-a-url' }
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.code, 'invalid_request');
  });

  test('DELETE /api/downloads/:id - should return standardized 404 for missing job', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/downloads/missing-id'
    });

    assert.strictEqual(response.statusCode, 404);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.code, 'download_not_found');
  });

  test('GET /api/library/:id - should return standardized 404 for missing manga', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/library/missing-manga'
    });

    assert.strictEqual(response.statusCode, 404);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.code, 'manga_not_found');
  });

  test('Settings Persistence - should save and retrieve settings via Prisma', async () => {
    const testId = `chat-${Date.now()}`;
    
    // 1. Save settings
    const saveResponse = await app.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { telegram_token: 'test-token', telegram_chat_id: testId }
    });
    assert.strictEqual(saveResponse.statusCode, 200);

    // 2. Retrieve and verify
    const getResponse = await app.inject({
      method: 'GET',
      url: '/api/settings'
    });
    assert.strictEqual(getResponse.statusCode, 200);
    const body = JSON.parse(getResponse.body);
    assert.strictEqual(body.telegram_chat_id, testId);
  });
});
