import fs from 'node:fs';
import { applySettingsFile } from './admin/settingsFile.js';
import { ALLOWED_KEYS } from './admin/allowedKeys.js';

// Load settings from the .env file (if it exists)
if (fs.existsSync('.env')) {
    process.loadEnvFile('.env');
}
// Settings changed in the NAS admin panel (data/settings.json) go before .env
applySettingsFile(ALLOWED_KEYS);

// The internal admin routes for the NAS admin panel only work with this key (same value in the panel's .env)
export const ADMIN_KEY = (process.env.ADMIN_KEY || '').trim();

// Switched off in the admin panel: the chat button disappears from the shop and the chat API answers "not available"
export const CHAT_ENABLED = (process.env.CHAT_ENABLED || 'true').trim() !== 'false';

const env = (name, fallback = '') => (process.env[name] || fallback).trim();

export const PORT = Number(env('PORT', '8090'));

// Put Kasper's tunnel address in the shop automatically (shop/metafield kasper.widget_url), see shopify/widgetAddress.js
export const PUBLISH_WIDGET_URL = env('PUBLISH_WIDGET_URL', 'false') === 'true';
export const TUNNEL_INFO_URL = env('TUNNEL_INFO_URL', 'http://casper-tunnel:20241/quicktunnel');

// Which "brain" answers the customer:
//   test   = fixed answers and keyword matching, no AI (free, for testing the whole flow)
//   claude = Claude reads the question, Kasper answers with the same fixed texts (needs ANTHROPIC_API_KEY)
export const CHAT_MODE = env('CHAT_MODE', 'test');

// Claude (only used when CHAT_MODE=claude)
export const claude = {
    apiKey: env('ANTHROPIC_API_KEY'),
    model: env('CLAUDE_MODEL', 'claude-haiku-5-5'),
};

// Websites that may use the chat (your shop domains), comma separated.
// Example: https://laboratoriumdiscounter.nl,https://www.laboratoriumdiscounter.nl
export const ALLOWED_ORIGINS = env('ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

// Shopify. Leave SHOPIFY_CLIENT_ID empty to use the fake test orders in shopify/fixtures.js
export const shopify = {
    storeDomain: env('SHOPIFY_STORE_DOMAIN'),
    clientId: env('SHOPIFY_CLIENT_ID'),
    clientSecret: env('SHOPIFY_CLIENT_SECRET'),
    // Public shop address, used for product links (e.g. https://laboratoriumdiscounter.nl)
    shopUrl: env('SHOP_URL'),
    // Own brand: always shown first in stock answers, with a "Huismerk" label.
    // A product counts as own brand when it has this tag OR this vendor.
    houseBrandTag: env('HOUSE_BRAND_TAG', 'Huismerk'),
    houseBrandVendor: env('HOUSE_BRAND_VENDOR', 'Laboratoriumdiscounter'),
};
export const useFakeShopify = !shopify.clientId;

// Partial shipping: the customer can choose "send what is in stock now" or "wait and send everything together".
//   off = the bot does not offer the choice
//   log = the choice is only written to the log (for testing)
//   tag = the choice is saved as a tag on the Shopify order (needs write_orders)
export const SPLIT_SHIPMENT_MODE = env('SPLIT_SHIPMENT_MODE', 'log');

// Contact form: where the customer's message goes
export const contact = {
    to: env('CONTACT_EMAIL_TO', 'info@laboratoriumdiscounter.nl'),
    // When e-mail is off, contact requests are saved as files in this folder instead
    saveDir: env('CONTACT_SAVE_DIR', './data/contact-requests'),
    // Saved contact requests contain personal data: they are deleted after this many days (AVG)
    keepDays: Number(env('CONTACT_RETENTION_DAYS', '90')),
    email: {
        enabled: env('EMAIL_ENABLED', 'false') === 'true',
        host: env('SMTP_HOST'),
        port: Number(env('SMTP_PORT', '587')),
        user: env('SMTP_USER'),
        password: env('SMTP_PASSWORD'),
        from: env('EMAIL_FROM'),
    },
};

// Running behind the Cloudflare Tunnel: trust Cloudflare's header with the visitor's real address.
// Only set to true when the app can ONLY be reached through the tunnel (no open port).
export const TRUST_CLOUDFLARE = env('TRUST_CLOUDFLARE', 'false') === 'true';

// The test page (/test.html). Switch off when the app can be reached from the internet.
export const SHOW_TEST_PAGE = env('SHOW_TEST_PAGE', 'true') === 'true';

// Limits that keep the chat cheap and hard to abuse
export const limits = {
    maxMessageLength: 1000,
    maxMessagesPerConversation: 40,
    maxOrderLookupFailures: 5,
    maxContactRequestsPerConversation: 2,
    conversationIdleMinutes: 120,
};
