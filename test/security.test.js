import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { visitorKey, setTrustCloudflare, visitorBrake } from '../routes/rateLimit.js';
import { deleteOldContactRequests } from '../email/contactRequest.js';

const request = (ip, cfHeader) => ({ ip, get: (name) => (name === 'cf-connecting-ip' ? cfHeader : undefined) });

test('the Cloudflare header is only trusted behind the tunnel', () => {
    setTrustCloudflare(false);
    assert.equal(visitorKey(request('10.0.0.5', '1.2.3.4')), '10.0.0.5'); // a fake header changes nothing
    setTrustCloudflare(true);
    assert.equal(visitorKey(request('172.18.0.3', '1.2.3.4')), '1.2.3.4');
    assert.equal(visitorKey(request('172.18.0.3', undefined)), '172.18.0.3');
    setTrustCloudflare(false);
});

test('the visitor brake stops after the maximum', () => {
    const brake = visitorBrake({ max: 2, minutes: 60, label: 'test' });
    assert.equal(brake.allowed('a'), true);
    brake.count('a');
    brake.count('a');
    assert.equal(brake.allowed('a'), false);
    assert.equal(brake.allowed('b'), true); // other visitors are not affected
});

test('contact requests older than the retention period are deleted', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'casper-contact-'));
    const old = path.join(dir, 'old.txt');
    const fresh = path.join(dir, 'fresh.txt');
    fs.writeFileSync(old, 'x');
    fs.writeFileSync(fresh, 'x');
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    fs.utimesSync(old, hundredDaysAgo, hundredDaysAgo);

    deleteOldContactRequests({ saveDir: dir, keepDays: 90 });
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(fresh), true);
    fs.rmSync(dir, { recursive: true, force: true });
});
