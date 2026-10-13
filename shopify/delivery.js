import { adminGraphql } from './shopifyClient.js';

// Stock label and delivery time, exactly like the website.
// This is a copy of the theme's own logic (theme files snippets/lab-delivery-calc.liquid and
// blocks/house-badge.liquid, 2026-10-08). When the theme changes, change this file too.
//
// The times come from the shop metafield custom.delivery_rules (zones per country, days per zone,
// extra days/weeks per supplier group). It is read from Shopify and kept for 10 minutes.

let cachedRules = null;

export async function getDeliveryRules(settings) {
    if (cachedRules && cachedRules.expiresAt > Date.now()) return cachedRules.value;
    const data = await adminGraphql(settings, `{ shop { metafield(namespace: "custom", key: "delivery_rules") { value } } }`);
    let value = null;
    try {
        value = JSON.parse(data.shop.metafield?.value || 'null');
    } catch {
        console.log('custom.delivery_rules is not valid JSON, delivery times are not shown');
    }
    cachedRules = { value, expiresAt: Date.now() + 10 * 60 * 1000 };
    return value;
}

// Supplier group of a product: metafield custom.delivery_group, otherwise from the vendor
function deliveryGroup(product) {
    const group = product.deliveryGroup?.value;
    if (group) return group;
    return { Laboratoriumdiscounter: 'stock', 'Carl Roth': 'roth', TCI: 'tci' }[product.vendor] ?? 'other';
}

function jsonList(value) {
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// custom.bulk_skus: "SKU1,SKU2" (or a list)
function skuList(value) {
    if (!value) return [];
    const list = String(value).trim().startsWith('[') ? jsonList(value) : String(value).split(',');
    return list.map((sku) => String(sku).trim()).filter(Boolean);
}

const variants = (product) => product.variants?.nodes ?? [];

// The bulk products ("refill_from") that own-brand bottles are filled from.
// Returns the handles we must look up to know whether the bulk is in stock.
export function bulkHandlesNeeded(products) {
    const handles = new Set();
    for (const product of products) {
        for (const source of jsonList(product.refillFrom?.value)) {
            if (!source.u && source.h) handles.add(source.h);
        }
    }
    return [...handles];
}

// Looks up the stock of the bulk products: { handle: { sku: quantity } }
export async function fetchBulkStock(settings, handles) {
    const clean = handles.map((handle) => String(handle).replace(/["\\]/g, '')).filter(Boolean).slice(0, 20);
    if (clean.length === 0) return {};
    const data = await adminGraphql(
        settings,
        `query Bulk($query: String!) { products(first: 20, query: $query) { nodes { handle variants(first: 50) { nodes { sku inventoryQuantity } } } } }`,
        { query: clean.map((handle) => `handle:"${handle}"`).join(' OR ') },
    );
    const stock = {};
    for (const product of data.products.nodes) {
        stock[product.handle] = Object.fromEntries(variants(product).map((variant) => [variant.sku, variant.inventoryQuantity ?? 0]));
    }
    return stock;
}

// Delivery time for one size (variant), for one piece. Same as lab-delivery-calc.liquid with need = 1.
// Returns { tone, label, unit, lo, hi } or null (= the website shows nothing).
//   tone: ok / few / none     label: many / few / refill / deliverable / none     unit: days / weeks
export function variantDelivery(rules, product, variant, country, bulkStock = {}) {
    if (!rules || !variant.availableForSale) return null;

    const group = deliveryGroup(product);
    const tracked = Boolean(variant.inventoryItem?.tracked);
    const qty = variant.inventoryQuantity ?? 0;
    if (group === 'stock' && !tracked) return null;

    const zone = rules.zone?.[country] || rules.default_zone;
    const stockDays = rules.stock_days?.[zone];
    if (!stockDays) return null;
    const far = (rules.far || []).includes(country);
    const g = rules.groups?.[group] || {};
    const few = rules.few ?? 4;

    let tone = 'ok';
    let label;
    let unit = 'days';
    let [lo, hi] = stockDays;
    const weeks = (settings) => {
        unit = 'weeks';
        [lo, hi] = (far ? settings?.weeks_far ?? settings?.oos_weeks_far : settings?.weeks ?? settings?.oos_weeks) || [lo, hi];
    };

    if (tracked && qty > 0) {
        label = qty > few ? 'many' : 'few';
        if (qty <= few) tone = 'few';
    } else if (group === 'stock') {
        // Own brand at 0: filled from a bulk product in stock -> in-stock days + refill days;
        // the bulk size itself at 0 -> its outside supplier's lead time; otherwise out of stock
        const bulkSkus = skuList(product.bulkSkus?.value);
        let bulkFree = false;
        if (!bulkSkus.includes(variant.sku)) {
            for (const source of jsonList(product.refillFrom?.value)) {
                if (source.u || (bulkStock[source.h]?.[source.s] ?? 0) > 0) bulkFree = true;
            }
        }
        if (bulkFree) {
            label = 'refill';
            lo += rules.refill_days ?? 0;
            hi += rules.refill_days ?? 0;
        } else if (bulkSkus.includes(variant.sku) && product.bulkGroup?.value) {
            const bulkGroup = rules.groups?.[product.bulkGroup.value] || {};
            label = 'deliverable';
            if (bulkGroup.days_plus) {
                lo += bulkGroup.days_plus;
                hi += bulkGroup.days_plus;
            } else {
                weeks({ weeks: bulkGroup.weeks, weeks_far: bulkGroup.weeks_far });
            }
        } else {
            label = 'none';
            tone = 'none';
            weeks({ oos_weeks: g.oos_weeks, oos_weeks_far: g.oos_weeks_far });
        }
    } else if (g.days_plus) {
        label = 'deliverable';
        lo += g.days_plus;
        hi += g.days_plus;
    } else {
        label = 'deliverable';
        weeks({ weeks: g.weeks, weeks_far: g.weeks_far });
    }

    // Sizes that travel as dangerous goods (variant custom.transport = ADR) ship slower
    if (unit === 'days' && variant.transport?.value === 'ADR') {
        lo += rules.adr_days ?? 0;
        hi += rules.adr_days ?? 0;
    }
    return { tone, label, unit, lo, hi };
}

// The stock pill on the product card. Same as house-badge.liquid:
//   in    = a tracked size has stock                         "Op voorraad" (green)
//   avail = own brand filled from bulk, or outside supplier  "Leverbaar" (blue)
//   out   = own brand, nothing in stock                      "Niet op voorraad" (orange)
//   null  = no pill (product not for sale)
export function productStock(product) {
    if (!variants(product).some((variant) => variant.availableForSale)) return null;
    const group = product.deliveryGroup?.value || (product.vendor === 'Laboratoriumdiscounter' ? 'stock' : 'other');
    const tracked = variants(product).filter((variant) => variant.inventoryItem?.tracked);
    if (tracked.some((variant) => variant.availableForSale && (variant.inventoryQuantity ?? 0) > 0)) return 'in';
    if (group !== 'stock') return 'avail';
    if (tracked.length === 0) return null;
    return jsonList(product.refillFrom?.value).length > 0 || product.bulkGroup?.value ? 'avail' : 'out';
}

// Delivery time of the size the product page shows first: the first size that is for sale
// (Shopify's selected_or_first_available_variant), so the chat says the same as the product page
export function productDelivery(rules, product, country, bulkStock) {
    const first = variants(product).find((variant) => variant.availableForSale);
    const time = first ? variantDelivery(rules, product, first, country, bulkStock) : null;
    return time ? { unit: time.unit, lo: time.lo, hi: time.hi } : null;
}
