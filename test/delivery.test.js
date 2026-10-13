import { test } from 'node:test';
import assert from 'node:assert/strict';

import { variantDelivery, productStock, productDelivery } from '../shopify/delivery.js';
import { fakeDeliveryRules as rules } from '../shopify/fixtures.js';

// Same cases as the theme's lab-delivery-calc.liquid, with the real custom.delivery_rules

const size = (quantity, extra = {}) => ({ sku: 'A', availableForSale: true, inventoryQuantity: quantity, inventoryItem: { tracked: true }, transport: null, ...extra });
const product = (vendor, group, sizes, extra = {}) => ({ vendor, deliveryGroup: group ? { value: group } : null, variants: { nodes: sizes }, ...extra });
const time = (result) => result && `${result.label} ${result.lo}-${result.hi} ${result.unit}`;

test('own brand in stock: in-stock days of the zone', () => {
    const p = product('Laboratoriumdiscounter', 'stock', [size(10)]);
    assert.equal(time(variantDelivery(rules, p, p.variants.nodes[0], 'NL')), 'many 1-2 days');
    assert.equal(time(variantDelivery(rules, p, p.variants.nodes[0], 'DE')), 'many 2-3 days');
    assert.equal(time(variantDelivery(rules, p, p.variants.nodes[0], 'US')), 'many 3-4 days'); // unknown country: default zone
});

test('few in stock shows the exact number tone', () => {
    const p = product('Laboratoriumdiscounter', 'stock', [size(3)]);
    const result = variantDelivery(rules, p, p.variants.nodes[0], 'NL');
    assert.equal(result.label, 'few');
    assert.equal(result.tone, 'few');
});

test('dangerous goods (ADR) get extra days', () => {
    const p = product('Laboratoriumdiscounter', 'stock', [size(10, { transport: { value: 'ADR' } })]);
    assert.equal(time(variantDelivery(rules, p, p.variants.nodes[0], 'NL')), 'many 4-5 days');
});

test('Carl Roth is always "deliverable" with +3 days, never out of stock', () => {
    const p = product('Carl Roth', 'roth', [size(0)]);
    assert.equal(time(variantDelivery(rules, p, p.variants.nodes[0], 'NL')), 'deliverable 4-5 days');
    assert.equal(productStock(p), 'avail');
});

test('group from vendor when the metafield is empty', () => {
    assert.equal(time(variantDelivery(rules, product('Carl Roth', null, [size(0)]), size(0), 'NL')), 'deliverable 4-5 days');
    assert.equal(time(variantDelivery(rules, product('TCI', null, [size(0)]), size(0), 'NL')), 'deliverable 1-2 weeks');
    assert.equal(time(variantDelivery(rules, product('Sigma', null, [size(0)]), size(0), 'GR')), 'deliverable 2-3 weeks'); // far country
});

test('own brand out of stock: weeks, unless it can be filled from bulk', () => {
    const empty = product('Laboratoriumdiscounter', 'stock', [size(0)]);
    assert.equal(time(variantDelivery(rules, empty, empty.variants.nodes[0], 'NL')), 'none 1-2 weeks');
    assert.equal(time(variantDelivery(rules, empty, empty.variants.nodes[0], 'IE')), 'none 2-3 weeks');
    assert.equal(productStock(empty), 'out');

    const refill = (bulkQuantity, unlimited = false) =>
        product('Laboratoriumdiscounter', 'stock', [size(0, { sku: 'SMALL' })], { refillFrom: { value: JSON.stringify([{ h: 'bulk', s: 'BIG', u: unlimited }]) } });
    assert.equal(time(variantDelivery(rules, refill(), size(0, { sku: 'SMALL' }), 'NL', { bulk: { BIG: 5 } })), 'refill 2-3 days');
    assert.equal(time(variantDelivery(rules, refill(), size(0, { sku: 'SMALL' }), 'NL', { bulk: { BIG: 0 } })), 'none 1-2 weeks');
    assert.equal(time(variantDelivery(rules, refill(0, true), size(0, { sku: 'SMALL' }), 'NL', {})), 'refill 2-3 days');
    assert.equal(productStock(refill()), 'avail');
});

test('the bulk size itself at 0 uses its supplier time', () => {
    const p = product('Laboratoriumdiscounter', 'stock', [size(0, { sku: 'BIG' })], { bulkSkus: { value: 'BIG' }, bulkGroup: { value: 'roth' } });
    assert.equal(time(variantDelivery(rules, p, p.variants.nodes[0], 'NL')), 'deliverable 4-5 days');
});

test('not for sale or untracked own brand: nothing shown', () => {
    assert.equal(variantDelivery(rules, product('Laboratoriumdiscounter', 'stock', []), size(5, { availableForSale: false }), 'NL'), null);
    assert.equal(variantDelivery(rules, product('Laboratoriumdiscounter', 'stock', []), size(5, { inventoryItem: { tracked: false } }), 'NL'), null);
    assert.equal(productStock(product('X', 'other', [size(5, { availableForSale: false })])), null);
});

test('product line shows the first size for sale, like the product page', () => {
    const p = product('Laboratoriumdiscounter', 'stock', [size(5, { sku: 'A', availableForSale: false }), size(0, { sku: 'B' }), size(8, { sku: 'C' })]);
    assert.deepEqual(productDelivery(rules, p, 'NL', {}), { unit: 'weeks', lo: 1, hi: 2 }); // size B
    assert.equal(productStock(p), 'in'); // the pill looks at all sizes (C has stock)
});
