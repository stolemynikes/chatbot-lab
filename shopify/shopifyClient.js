const API_VERSION = '2026-07';

// Access token for the Admin API.
// Dev Dashboard apps don't have a fixed token: we ask Shopify for one with the client ID + secret.
// The token works for about 24 hours, so we keep it and only ask for a new one when it runs out.
let cachedToken = null;

export async function getAccessToken({ storeDomain, clientId, clientSecret }) {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
        return cachedToken.value;
    }

    const response = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    // Shopify answers errors sometimes as JSON, sometimes as an HTML page with the reason in the title
    const raw = await response.text();
    let body = {};
    try {
        body = JSON.parse(raw);
    } catch {
        body = { error: raw.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() };
    }
    if (!response.ok || !body.access_token) {
        throw new Error(`Could not get a Shopify access token (${response.status}): ${body.error_description || body.error || 'unknown error'}`);
    }

    cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 86_399) * 1000, scope: body.scope };
    return cachedToken.value;
}

// The permissions (scopes) of the current token, e.g. "read_orders,read_products"
export function grantedScopes() {
    return cachedToken?.scope ?? '';
}

// Sends a GraphQL request to the Shopify Admin API.
// Values always go in `variables`, never pasted into the query text.
export async function adminGraphql(settings, query, variables = {}) {
    const token = await getAccessToken(settings);
    const response = await fetch(`https://${settings.storeDomain}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.errors) {
        throw new Error(`Shopify API error (${response.status}): ${JSON.stringify(body.errors || body)}`);
    }
    return body.data;
}
