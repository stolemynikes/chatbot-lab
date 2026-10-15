import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isPlaceholderCopy } from '../shopify/orders.js';

test('placeholder copies for visitors who are not logged in are recognised', () => {
    assert.equal(isPlaceholderCopy({ tags: ['staffelkorting', 'particulier-kopie'] }), true);
    assert.equal(isPlaceholderCopy({ tags: [], copyOf: { value: 'gid://shopify/Product/1' } }), true);
    assert.equal(isPlaceholderCopy({ tags: ['staffelkorting', 'zakelijk-only'], copyOf: null }), false);
});
