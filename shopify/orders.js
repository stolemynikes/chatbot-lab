import { adminGraphql } from './shopifyClient.js';
import { fakeOrders, fakeProducts, fakeDeliveryRules } from './fixtures.js';
import { getDeliveryRules, bulkHandlesNeeded, fetchBulkStock, productStock, productDelivery } from './delivery.js';

// Order numbers look like LD1004 (letters + digits). Customers may also type "#LD1004", "ld 1004" or just "1004".
export function cleanOrderNumber(text, defaultPrefix = 'LD') {
    const compact = String(text || '').toUpperCase().replace(/[\s#.\-]/g, '');
    if (/^\d{3,12}$/.test(compact)) return defaultPrefix + compact;
    if (/^[A-Z]{1,6}\d{3,12}$/.test(compact)) return compact;
    return null;
}

// Finds an order number inside a sentence ("my order is LD1004") or null
export function findOrderNumber(text, defaultPrefix = 'LD') {
    // E-mail addresses are removed first, so "jan1990@example.com" is not read as order number JAN1990.
    // No space between letters and digits: "order 1004" means 1004, not ORDER1004.
    const withoutEmails = String(text || '').replace(/\S+@\S+/g, ' ');
    const match = withoutEmails.match(/#?\b([a-z]{1,4}-?\d{3,12}|\d{4,12})\b/i);
    return match ? cleanOrderNumber(match[1], defaultPrefix) : null;
}

export function cleanEmail(text) {
    const email = String(text || '').trim().toLowerCase();
    return /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/.test(email) ? email : null;
}

export function findEmail(text) {
    const match = String(text || '').match(/[^\s@<>()",;:]+@[a-z0-9.-]+\.[a-z]{2,24}/i);
    return match ? cleanEmail(match[0]) : null;
}

const ORDER_QUERY = `
    query FindOrder($query: String!) {
        orders(first: 5, query: $query) {
            nodes {
                id name email createdAt cancelledAt tags
                displayFulfillmentStatus displayFinancialStatus
                totalPriceSet { presentmentMoney { amount currencyCode } }
                lineItems(first: 100) {
                    nodes {
                        title variantTitle quantity unfulfilledQuantity
                        image { url(transform: { maxWidth: 120, maxHeight: 120 }) }
                        variant { inventoryQuantity inventoryItem { tracked } }
                    }
                }
                fulfillments(first: 20) { status trackingInfo(first: 5) { number url company } }
            }
        }
    }`;

// Looks up an order by number AND e-mail address. Both must match, otherwise null.
// The customer never learns which of the two was wrong (so nobody can guess order numbers).
export async function findOrder(settings, { orderNumber, email, useFake }) {
    let candidates;
    if (useFake) {
        candidates = fakeOrders.filter((order) => order.name === orderNumber);
    } else {
        const data = await adminGraphql(settings, ORDER_QUERY, { query: `name:${orderNumber}` });
        candidates = data.orders.nodes;
    }
    const order = candidates.find(
        (candidate) => candidate.name.toUpperCase() === orderNumber && String(candidate.email || '').toLowerCase() === email,
    );
    return order ? summarizeOrder(order) : null;
}

// Turns the Shopify order into the few things the customer may see.
// No address, phone or payment details: the chat only needs status, items and tracking.
export function summarizeOrder(order) {
    const items = order.lineItems.nodes.map((line) => {
        const tracked = Boolean(line.variant?.inventoryItem?.tracked);
        const available = line.variant?.inventoryQuantity ?? 0;
        // Shopify's "available" already has this order's reservation taken off,
        // so below zero means there is not enough stock for the orders waiting.
        const short = tracked && line.unfulfilledQuantity > 0 && available < 0 ? Math.min(line.unfulfilledQuantity, -available) : 0;
        return {
            title: line.title,
            variant: line.variantTitle || null,
            quantity: line.quantity,
            waiting: line.unfulfilledQuantity,
            short,
            tracked,
            image: shopifyImage(line.image?.url),
        };
    });

    let status = String(order.displayFulfillmentStatus || '').toLowerCase();
    if (order.cancelledAt) status = 'cancelled';

    const tracking = order.fulfillments
        .flatMap((fulfillment) => fulfillment.trackingInfo)
        .filter((info) => info.number || info.url)
        .map((info) => ({ number: info.number, url: safeUrl(info.url), company: info.company }));

    const physicalWaiting = items.filter((item) => item.tracked && item.waiting > 0);
    const somethingShort = physicalWaiting.some((item) => item.short > 0);
    const somethingReady = physicalWaiting.some((item) => item.waiting > item.short);
    const alreadyChosen = order.tags.some((tag) => tag.startsWith('chat-shipping-'));
    const paid = ['paid', 'partially_refunded'].includes(String(order.displayFinancialStatus || '').toLowerCase());

    const total = order.totalPriceSet?.presentmentMoney;

    return {
        id: order.id,
        name: order.name,
        date: order.createdAt,
        status,
        items,
        tracking,
        total: total ? { amount: total.amount, currency: total.currencyCode } : null,
        // Partial shipping only makes sense when part of the order can go now and part has to wait
        canSplit: !order.cancelledAt && paid && somethingShort && somethingReady && !alreadyChosen,
    };
}

// Only pictures from Shopify's own image server reach the customer's screen
function shopifyImage(url) {
    return /^https:\/\/cdn\.shopify\.com\//.test(url || '') ? url : null;
}

// Only http(s) links reach the customer's screen
function safeUrl(url) {
    return /^https?:\/\//i.test(url || '') ? url : null;
}

const PRODUCT_QUERY = `
    query FindProducts($query: String!) {
        products(first: 10, query: $query) {
            nodes {
                title handle status vendor tags
                deliveryGroup: metafield(namespace: "custom", key: "delivery_group") { value }
                refillFrom: metafield(namespace: "custom", key: "refill_from") { value }
                bulkSkus: metafield(namespace: "custom", key: "bulk_skus") { value }
                bulkGroup: metafield(namespace: "custom", key: "bulk_group") { value }
                variants(first: 30) {
                    nodes {
                        sku availableForSale inventoryQuantity inventoryItem { tracked }
                        transport: metafield(namespace: "custom", key: "transport") { value }
                    }
                }
                featuredMedia { preview { image { url(transform: { maxWidth: 160, maxHeight: 160 }) } } }
                priceRangeV2 { minVariantPrice { amount currencyCode } }
                variantsCount { count }
            }
        }
    }`;

// Own brand = has the house brand tag (e.g. "Huismerk") OR the house brand vendor (e.g. "Laboratoriumdiscounter")
export function isHouseBrand(settings, product) {
    const tag = (settings.houseBrandTag || '').toLowerCase();
    const vendor = (settings.houseBrandVendor || '').toLowerCase();
    return Boolean(
        (tag && (product.tags || []).some((t) => t.toLowerCase() === tag)) || (vendor && String(product.vendor || '').toLowerCase() === vendor),
    );
}

// Shopify search filter for the own brand, e.g. (vendor:"Laboratoriumdiscounter" OR tag:"Huismerk")
function houseBrandFilter(settings) {
    const clean = (value) => String(value || '').replace(/["\\()]/g, '').trim();
    const parts = [];
    if (clean(settings.houseBrandVendor)) parts.push(`vendor:"${clean(settings.houseBrandVendor)}"`);
    if (clean(settings.houseBrandTag)) parts.push(`tag:"${clean(settings.houseBrandTag)}"`);
    return parts.length > 0 ? `(${parts.join(' OR ')})` : '';
}

// Searches products by name. Only letters, digits and a few signs are kept,
// so the customer's text cannot change the search itself.
// country: the visitor's country (e.g. "NL"), for the delivery time
export async function findProducts(settings, { text, useFake, country = 'NL' }) {
    const words = String(text || '')
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}\s,.%µ+-]/gu, ' ')
        .split(/\s+/)
        .map((word) => word.toLowerCase().replace(/^[-+]+|[.,]+$/g, ''))
        .filter((word) => word.length >= 2)
        .slice(0, 5);
    if (words.length === 0) return [];

    // Dutch names are often one word ("Kaliumjodide") while customers type two ("kalium jodide"),
    // and Shopify cannot search in the middle of a word. So we try, until something is found:
    //   1. the words glued together: kaliumjodide*
    //   2. every word as the start of a word: kalium* jodide*
    //   3. Shopify's normal text search
    const joined = words.join('');
    const searches = [
        words.length > 1 ? `title:${joined}*` : null,
        words.map((word) => `title:${word}*`).join(' '),
        words.join(' '),
    ].filter(Boolean);

    let products = [];
    if (useFake) {
        products = fakeProducts.filter((product) => {
            const title = product.title.toLowerCase();
            return title.replace(/\s/g, '').includes(joined) || words.every((word) => title.includes(word));
        });
    } else {
        for (const search of searches) {
            const data = await adminGraphql(settings, PRODUCT_QUERY, { query: `status:active ${search}` });
            products = data.products.nodes;
            if (products.length === 0) continue;

            // Own brand always first: also search only the own brand, so it is found even when
            // Shopify puts it below the first 10 results
            const brand = houseBrandFilter(settings);
            if (brand) {
                const own = await adminGraphql(settings, PRODUCT_QUERY, { query: `status:active ${search} ${brand}` });
                const seen = new Set(products.map((product) => product.handle));
                products = [...own.products.nodes.filter((product) => !seen.has(product.handle)), ...products];
            }
            break;
        }
    }

    // Own brand first, then the best match: titles that contain what the customer typed (spaces ignored)
    const score = (product) => {
        const compact = product.title.toLowerCase().replace(/\s/g, '');
        return (isHouseBrand(settings, product) ? 10 : 0) + (compact.startsWith(joined) ? 2 : 0) + (compact.includes(joined) ? 1 : 0);
    };
    products = [...products].sort((a, b) => score(b) - score(a)).slice(0, 5);

    // Stock label and delivery time, calculated exactly like the website does
    let rules = null;
    let bulkStock = {};
    if (useFake) {
        rules = fakeDeliveryRules;
    } else {
        try {
            rules = await getDeliveryRules(settings);
            bulkStock = await fetchBulkStock(settings, bulkHandlesNeeded(products));
        } catch (error) {
            console.log(`Delivery times not available: ${error.message}`); // the cards still show, without a time
        }
    }

    return products.map((product) => ({
        title: product.title,
        houseBrand: isHouseBrand(settings, product),
        stock: productStock(product), // in / avail / out / null
        inStock: productStock(product) === 'in',
        delivery: productDelivery(rules, product, country, bulkStock), // { unit, lo, hi } or null
        image: shopifyImage(product.featuredMedia?.preview?.image?.url),
        price: product.priceRangeV2 ? { amount: product.priceRangeV2.minVariantPrice.amount, currency: product.priceRangeV2.minVariantPrice.currencyCode } : null,
        priceFrom: (product.variantsCount?.count ?? 1) > 1, // several sizes: "from € ..."
        url: settings.shopUrl ? `${settings.shopUrl.replace(/\/$/, '')}/products/${encodeURIComponent(product.handle)}` : null,
    }));
}
