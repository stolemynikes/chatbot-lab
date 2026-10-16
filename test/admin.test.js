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
import { createStats } from '../admin/stats.js';

const KEY = 'k'.repeat(40);

// Day counters in a temporary file, with some numbers for today
function fakeStats(today = {}) {
    const stats = createStats({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kasper-stats-')), 'stats.json') });
    for (const [counter, amount] of Object.entries(today)) stats.add(counter, amount);
    return stats;
}

function start(env = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kasper-admin-'));
    process.env.SETTINGS_PATH = path.join(dir, 'settings.json');
    let restarts = 0;
    const provider = createKasperAdmin({ env, stats: fakeStats({ conversations: 3, contactSent: 1 }), useFakeShopify: true });
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
    const stats = fakeStats();
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
    const admin = createKasperAdmin({ env: { SHOPIFY_CLIENT_ID: 'id', SHOPIFY_CLIENT_SECRET: 's' }, stats: fakeStats(), useFakeShopify: false, fetchFn });
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

test('stats: counts per day, week and month; tokens too; never anything customers wrote', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kasper-stats-')), 'stats.json');
    let now = new Date('2026-10-16T10:00:00');
    const stats = createStats({ file, now: () => now });
    stats.add('conversations');
    stats.add('conversations');
    stats.add('contactSent');
    stats.add('inputTokens', 1200);
    stats.add('outputTokens', 80);
    stats.add('nonsense', 5);
    stats.add('conversations', -3);
    now = new Date('2026-10-14T10:00:00'); // Wednesday, same week and month
    stats.add('conversations');
    now = new Date('2026-10-16T12:00:00');
    const s = stats.summary();
    assert.equal(s.today.conversations, 2);
    assert.equal(s.week.conversations, 3);
    assert.equal(s.month.inputTokens, 1200);
    assert.equal(s.last30.length, 30);
    assert.equal(s.last30.at(-1).conversations, 2);
    stats.save();
    const saved = fs.readFileSync(file, 'utf8');
    assert.ok(!saved.includes('nonsense'));
    assert.deepEqual(Object.keys(JSON.parse(saved).days).sort(), ['2026-10-14', '2026-10-16']);
});

test('admin status: figures for the panel, with "handled without the contact form"', async () => {
    const stats = fakeStats({ conversations: 5, contactSent: 2, inputTokens: 100, outputTokens: 10 });
    const status = await createKasperAdmin({ env: {}, stats, useFakeShopify: true }).status();
    const today = status.figures.periods[0].values;
    assert.equal(today.helped, 3);
    assert.equal(today.tokens, 110);
    assert.ok(status.figures.rows.some((r) => r.key === 'tokens'));
});

test('mail server: e-mail cannot be switched on half filled in; test mail only when complete', async () => {
    const sent = [];
    const env = { CONTACT_EMAIL_TO: 'info@lab.nl' };
    const admin = createKasperAdmin({ env, stats: fakeStats(), useFakeShopify: true, sendTestMail: async (e) => sent.push(e.CONTACT_EMAIL_TO) });
    assert.equal(admin.validate({ EMAIL_ENABLED: 'true', SMTP_HOST: 'smtp.hostnet.nl' }).length, 1);
    assert.deepEqual(admin.validate({ EMAIL_ENABLED: 'true', SMTP_HOST: 'smtp.hostnet.nl', SMTP_USER: 'kasper@lab.nl', SMTP_PASSWORD: 'geheim', EMAIL_FROM: 'Kasper <kasper@lab.nl>' }), []);
    for (const bad of [{ SMTP_HOST: 'smtp.hostnet.nl/x' }, { SMTP_PORT: '99999' }, { EMAIL_FROM: 'a@b.nl\nBcc: x@y.nl' }]) assert.equal(admin.validate(bad).length, 1, JSON.stringify(bad));
    await assert.rejects(admin.actions['test-mail']());
    Object.assign(env, { SMTP_HOST: 'smtp.hostnet.nl', SMTP_USER: 'u', SMTP_PASSWORD: 'p', EMAIL_FROM: 'k@lab.nl' });
    assert.equal((await admin.actions['test-mail']()).ok, true);
    assert.deepEqual(sent, ['info@lab.nl']);
});

test('figures: cost estimate from the prices per million tokens; none without prices', async () => {
    const stats = fakeStats({ inputTokens: 2_000_000, outputTokens: 100_000 });
    const withPrices = await createKasperAdmin({ env: { CLAUDE_PRICE_INPUT: '1', CLAUDE_PRICE_OUTPUT: '5,5' }, stats, useFakeShopify: true }).status();
    const today = withPrices.figures.periods[0].values;
    assert.equal(today.costIn, 2);
    assert.equal(today.costOut, 0.55);
    assert.equal(today.cost, 2.55);
    const without = await createKasperAdmin({ env: {}, stats, useFakeShopify: true }).status();
    assert.equal(without.figures.periods[0].values.cost, null);
    const admin = createKasperAdmin({ env: {}, stats, useFakeShopify: true });
    assert.deepEqual(admin.validate({ CLAUDE_PRICE_INPUT: '0,8' }), []);
    for (const bad of ['-1', 'gratis', '1e9', '1.2.3']) assert.equal(admin.validate({ CLAUDE_PRICE_INPUT: bad }).length, 1, bad);
});

test('chat address: written to the shop once per new tunnel address, never a strange address', async () => {
    const { createWidgetAddress } = await import('../shopify/widgetAddress.js');
    let hostname = 'beats-sentence.trycloudflare.com';
    const writes = [];
    const graphql = async (settings, query, variables) => {
        if (query.includes('shop { id }')) return { shop: { id: 'gid://shopify/Shop/1' } };
        writes.push(variables.metafields[0]);
        return { metafieldsSet: { userErrors: [] } };
    };
    const fetchFn = async () => new Response(JSON.stringify({ hostname }));
    const w = createWidgetAddress({ shopify: {}, tunnelInfoUrl: 'http://casper-tunnel:20241/quicktunnel', fetchFn, graphql });
    await w.update();
    await w.update();
    assert.equal(writes.length, 1, 'same address: no second write');
    assert.deepEqual(writes[0], { ownerId: 'gid://shopify/Shop/1', namespace: 'kasper', key: 'widget_url', type: 'url', value: 'https://beats-sentence.trycloudflare.com' });
    hostname = 'new-one.trycloudflare.com';
    await w.update();
    assert.equal(writes.length, 2);
    for (const bad of ['evil.com', 'x.trycloudflare.com.evil.com', 'a.trycloudflare.com/"><script>', '']) {
        hostname = bad;
        await w.update();
    }
    assert.equal(writes.length, 2, 'attacks: never written');
});

test('chat address: a refused write is shown as "no access"', async () => {
    const { createWidgetAddress } = await import('../shopify/widgetAddress.js');
    const graphql = async (s, query) => {
        if (query.includes('shop { id }')) return { shop: { id: 'gid://shopify/Shop/1' } };
        throw new Error('Shopify API error (200): [{"message":"Access denied for metafieldsSet field."}]');
    };
    const w = createWidgetAddress({ shopify: {}, tunnelInfoUrl: 'x', fetchFn: async () => new Response('{"hostname":"a-b.trycloudflare.com"}'), graphql });
    const state = await w.update();
    assert.equal(state.error, 'no-access');
    const status = await createKasperAdmin({ env: { PUBLISH_WIDGET_URL: 'true' }, stats: fakeStats(), useFakeShopify: false, widgetAddress: w }).status();
    assert.equal(status.connections.find((c) => c.id === 'widget').state, 'geen toegang');
});

test('admin settings: prices work at once without a restart; other settings restart', async () => {
    const { server, ask, restarts } = start();
    try {
        const live = await ask('PUT', '/internal/admin/settings', { headers: auth, body: { values: { CLAUDE_PRICE_INPUT: '1', CLAUDE_PRICE_OUTPUT: '5' } } });
        assert.equal(live.body.restarting, false);
        assert.equal(restarts(), 0);
        const other = await ask('PUT', '/internal/admin/settings', { headers: auth, body: { values: { CLAUDE_PRICE_INPUT: '2', SPLIT_SHIPMENT_MODE: 'off' } } });
        assert.equal(other.body.restarting, true);
        assert.equal(restarts(), 1);
    } finally {
        server.close();
    }
});

test('mail server: an incoming mail server or port is refused with a clear reason', () => {
    const admin = createKasperAdmin({ env: {}, stats: fakeStats(), useFakeShopify: true });
    assert.equal(admin.validate({ SMTP_PORT: '993' }).length, 1);
    assert.equal(admin.validate({ SMTP_HOST: 'imap.hostnet.nl' }).length, 1);
    assert.deepEqual(admin.validate({ SMTP_HOST: 'smtp.hostnet.nl', SMTP_PORT: '587' }), []);
});
