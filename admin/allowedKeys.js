// The settings the NAS admin panel may change for Kasper (saved in data/settings.json, before .env)
export const ALLOWED_KEYS = [
    'CHAT_ENABLED',
    'CHAT_MODE',
    'CLAUDE_MODEL',
    'CLAUDE_PRICE_INPUT',
    'CLAUDE_PRICE_OUTPUT',
    'ANTHROPIC_API_KEY',
    'SPLIT_SHIPMENT_MODE',
    'EMAIL_ENABLED',
    'ALLOWED_ORIGINS',
    'PUBLISH_WIDGET_URL',
    'SHOPIFY_CLIENT_ID',
    'SHOPIFY_CLIENT_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'EMAIL_FROM',
    // Shared with the other apps, set in the panel tab Algemeen
    'SHOPIFY_STORE_DOMAIN',
    'CONTACT_EMAIL_TO',
];
