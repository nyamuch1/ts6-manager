import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { settingsRoutes } from './settings.routes.js';
import { errorHandler } from '../middleware/error-handler.js';
import { localeMiddleware } from '../i18n/middleware.js';

function fixture(role: 'admin' | 'viewer') {
  const settings = new Map<string, string>();
  const prisma = {
    appSetting: {
      findUnique: async ({ where }: any) => settings.has(where.key)
        ? { key: where.key, value: settings.get(where.key) }
        : null,
      upsert: async ({ where, create, update }: any) => {
        settings.set(where.key, create?.value ?? update.value);
        return { key: where.key, value: settings.get(where.key) };
      },
    },
  };

  const app = express();
  app.use(express.json());
  app.use(localeMiddleware);
  app.use((req, _res, next) => {
    (req as any).user = { id: 1, username: 'admin', role };
    next();
  });
  app.locals.prisma = prisma;
  app.use('/api/settings', settingsRoutes);
  app.use(errorHandler);

  const server = app.listen(0);
  return new Promise<{ base: string; settings: Map<string, string>; close: () => Promise<void> }>((resolve) => {
    server.once('listening', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        base: `http://127.0.0.1:${port}/api/settings`,
        settings,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

describe('bot chat language setting', () => {
  let admin: Awaited<ReturnType<typeof fixture>>;
  let viewer: Awaited<ReturnType<typeof fixture>>;

  before(async () => {
    admin = await fixture('admin');
    viewer = await fixture('viewer');
  });

  after(async () => {
    await admin.close();
    await viewer.close();
  });

  it('defaults to English when nothing is stored', async () => {
    const response = await fetch(`${admin.base}/bot-chat-language`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { language: 'en' });
  });

  it('stores and returns the instance default', async () => {
    const update = await fetch(`${admin.base}/bot-chat-language`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'zh-CN' }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual(await update.json(), { language: 'zh-CN' });
    assert.equal(admin.settings.get('default_bot_language'), 'zh-CN');

    const read = await fetch(`${admin.base}/bot-chat-language`);
    assert.deepEqual(await read.json(), { language: 'zh-CN' });
  });

  it('rejects unsupported languages with a localized message', async () => {
    const response = await fetch(`${admin.base}/bot-chat-language`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'zh-CN' },
      body: JSON.stringify({ language: 'fr' }),
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string };
    assert.equal(body.error, '语言必须为 en、zh-CN 或 null');
    assert.equal(response.headers.get('content-language'), 'zh-CN');
  });

  it('is admin-only', async () => {
    const response = await fetch(`${viewer.base}/bot-chat-language`);
    assert.equal(response.status, 403);
  });
});
