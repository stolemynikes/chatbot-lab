// The settings the NAS admin panel may change for Kasper (saved in data/settings.json, before .env)
export const ALLOWED_KEYS = [
    'CHAT_ENABLED',
    'CHAT_MODE',
    'CLAUDE_MODEL',
    'ANTHROPIC_API_KEY',
    'SPLIT_SHIPMENT_MODE',
    'EMAIL_ENABLED',
    'ALLOWED_ORIGINS',
    'SHOPIFY_CLIENT_ID',
    'SHOPIFY_CLIENT_SECRET',
    // Shared with the other apps, set in the panel tab Algemeen
    'SHOPIFY_STORE_DOMAIN',
    'CONTACT_EMAIL_TO',
];
