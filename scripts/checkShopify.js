// Read-only connection test: gets a token, shows the permissions and reads a few orders and products.
// Changes nothing in the store. Run with: node scripts/checkShopify.js
import { shopify, useFakeShopify } from '../config.js';
import { adminGraphql, grantedScopes } from '../shopify/shopifyClient.js';

if (useFakeShopify) {
    console.log('SHOPIFY_CLIENT_ID is empty in .env, so the chat uses fake test orders. Fill it in to test a real store.');
    process.exit(0);
}
if (!shopify.storeDomain || !shopify.clientSecret) {
    console.log('Fill in SHOPIFY_STORE_DOMAIN and SHOPIFY_CLIENT_SECRET in .env first.');
    process.exit(1);
}

// Show only the start of the secret, never the whole thing
console.log(`Store: ${shopify.storeDomain}`);
console.log(`Client secret: ${shopify.clientSecret.slice(0, 6)}... (${shopify.clientSecret.length} characters)`);

try {
    const data = await adminGraphql(shopify, `{ shop { name } }`);
    console.log(`Connected to shop: ${data.shop.name}`);
} catch (error) {
    console.log(`Could not connect: ${error.message}`);
    process.exit(1);
}

const scopes = grantedScopes().split(',').filter(Boolean);
console.log(`Permissions: ${scopes.join(', ') || '(unknown)'}`);
const needed = ['read_orders', 'read_products', 'read_inventory'];
const missing = needed.filter((scope) => !scopes.includes(scope));
if (missing.length > 0) console.log(`Missing permissions: ${missing.join(', ')} (add them in the Dev Dashboard and release a new version)`);

for (const [label, query] of [
    ['Last orders', `{ orders(first: 3, reverse: true) { nodes { name displayFulfillmentStatus } } }`],
    ['Products', `{ products(first: 3) { nodes { title totalInventory } } }`],
]) {
    try {
        const data = await adminGraphql(shopify, query);
        const nodes = Object.values(data)[0].nodes;
        console.log(`${label}: ${nodes.map((node) => node.name || node.title).join(', ') || '(none)'}`);
    } catch (error) {
        console.log(`${label}: could not read (${error.message.slice(0, 150)})`);
    }
}
