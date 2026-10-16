import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { adminRoute } from '../routes/adminRoute.js';
import { createLogBook } from '../admin/logBook.js';
import { readSettings } from '../admin/settingsFile.js';
import { createKasperAdmin, translateLine } from '../admin/kasperAdmin.js';

const KEY = 'k'.repeat(40);

function start(env = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasper-admin-'));
    process.env.SETTINGS_PATH = path.join(dir, 'settings.json');
    let restarts = 0;
    const provider = createKasperAdmin({ env, stats: { day: new Date().toISOString().slice(0, 10), conversationsToday: 3, contactToday: 1 }, useFakeShopify: true });
    const app = express();
    app.use('/internal/admin', adminRoute({ adminKey: KEY, provider, logBook: createLogBook({ dir: path.join(dir, 'logs'), translate: translateLine }), restart: () => restarts++ }));
    const server = app.listen(0);
    const ask = (method, url, { body, headers = {} } = {}) =>
        new Promise((resolve, reject) => {
            const request = http.request({ port: server.address().port, method, path: url, headers: { 'content-type': 'application/json', ...headers } }, (response) => {
                let text = '';
                response.on('data', (chunk) => (text += chunk));
                response.on('end', () => resolve({ status: response.statusCode, body: text ? JSON.parse(text) : null }));
            });
            request.on('error', reject);
            if (body) request.write(JSON.stringify(body));
            request.end();
        });
    return { server, ask, provider, restarts: () => restarts };
}

const auth = { authorization: `Bearer ${KEY}` };

test('admin routes: only with the key, never through the tunnel', async () => {
    const { server, ask } = start();
    try {
        assert.equal((await ask('GET', '/internal/admin/status')).status, 404);
        assert.equal((await ask('GET', '/internal/admin/status', { headers: { ...auth, 'cf-connecting-ip': '1.2.3.4' } })).status, 404);
        const ok = await ask('GET', '/internal/admin/status', { headers: auth });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.detail, 'Vandaag 3 gesprekken, waarvan 1 doorgestuurd via het contactformulier.');
    } finally {
        server.close();
    }
});

test('admin settings: valid values are saved, the AI key is never sent back', async () => {
    const { server, ask, restarts } = start({ ANTHROPIC_API_KEY: 'sk-ant-secret-value' });
    try {
        const settings = await ask('GET', '/internal/admin/settings', { headers: auth });
        assert.ok(!JSON.stringify(settings.body).includes('sk-ant-secret'));
        assert.equal((await ask('PUT', '/internal/admin/settings', { headers: auth, body: { values: { SPLIT_SHIPMENT_MODE: 'off', ALLOWED_ORIGINS: 'https://hevjuq-bg.myshopify.com' } } })).status, 200);
        assert.deepEqual(readSettings(), { SPLIT_SHIPMENT_MODE: 'off', ALLOWED_ORIGINS: 'https://hevjuq-bg.myshopify.com' });
        for (const values of [{ SPLIT_SHIPMENT_MODE: 'maybe' }, { ALLOWED_ORIGINS: 'http://evil.com/' }, { ANTHROPIC_API_KEY: 'nope' }, { SHOPIFY_CLIENT_SECRET: 'x' }]) {
            assert.equal((await ask('PUT', '/internal/admin/settings', { headers: auth, body: { values } })).status, 400);
        }
        assert.equal(restarts(), 1);
    } finally {
        server.close();
    }
});

test('admin restart only with the key', async () => {
    const { server, ask, restarts } = start();
    try {
        assert.equal((await ask('POST', '/internal/admin/restart')).status, 404);
        assert.equal((await ask('POST', '/internal/admin/restart', { headers: auth })).status, 200);
        assert.equal(restarts(), 1);
    } finally {
        server.close();
    }
});

test('admin status: TEST until AI and e-mail are both on; shared keys for the panel', async () => {
    const stats = { day: '2000-01-01' };
    const test1 = await createKasperAdmin({ env: { CHAT_MODE: 'claude' }, stats, useFakeShopify: false }).status();
    assert.equal(test1.mode, 'test');
    const live = await createKasperAdmin({ env: { CHAT_MODE: 'claude', EMAIL_ENABLED: 'true', ANTHROPIC_API_KEY: 'sk-ant-x', SHOPIFY_STORE_DOMAIN: 'lab.myshopify.com' }, stats, useFakeShopify: false }).status();
    assert.equal(live.mode, 'live');
    assert.deepEqual(live.testLive.map((p) => p.mode), ['live', 'live']);
    assert.deepEqual(live.sharedKeys, { shopDomain: 'SHOPIFY_STORE_DOMAIN', contactEmail: 'CONTACT_EMAIL_TO' });
});

test('attacks: shared store address must be .myshopify.com; Shopify test only calls that store', async () => {
    const calls = [];
    const fetchFn = async (url) => {
        calls.push(url);
        if (url.endsWith('/access_token')) return new Response(JSON.stringify({ access_token: 't' }), { status: 200 });
        return new Response(JSON.stringify({ data: { shop: { name: 'Lab', myshopifyDomain: 'lab.myshopify.com' } } }), { status: 200 });
    };
    const admin = createKasperAdmin({ env: { SHOPIFY_CLIENT_ID: 'id', SHOPIFY_CLIENT_SECRET: 's' }, stats: {}, useFakeShopify: false, fetchFn });
    for (const bad of ['evil.com', 'a.myshopify.com.evil.com', '']) assert.equal(admin.validate({ SHOPIFY_STORE_DOMAIN: bad }).length, 1, bad);
    assert.equal((await admin.actions['shopify-test']({ domain: 'evil.com' })).ok, false);
    assert.equal(calls.length, 0);
    assert.equal((await admin.actions['shopify-test']({ domain: 'lab.myshopify.com' })).ok, true);
    assert.ok(calls.every((url) => url.startsWith('https://lab.myshopify.com/')));
});

test('admin on/off saves CHAT_ENABLED', async () => {
    const { server, ask } = start();
    try {
        assert.equal((await ask('POST', '/internal/admin/enabled', { headers: auth, body: { enabled: false } })).status, 200);
        assert.equal(readSettings().CHAT_ENABLED, 'false');
    } finally {
        server.close();
    }
});
