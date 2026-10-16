import { adminGraphql } from './shopifyClient.js';

// Puts Kasper's current internet address in the shop, so the chat button keeps working when the quick tunnel
// gets a new address after a restart. The theme reads it (one time change in layout/theme.liquid):
//
//   {% if shop.metafields.kasper.widget_url %}<script src="{{ shop.metafields.kasper.widget_url.value }}/widget.js" defer></script>{% endif %}
//
// The address comes from the tunnel container itself (cloudflared shows it on http://casper-tunnel:20241/quicktunnel,
// only inside the Docker network). Only this one shop field is ever written.

const NAMESPACE = 'kasper';
const KEY = 'widget_url';
// Only an https address of a Cloudflare quick tunnel (or our own domain later): a script address in the shop
// must never become something else, even if the tunnel container would answer something strange
const SAFE_URL = /^https:\/\/[a-z0-9-]+\.(trycloudflare\.com|laboratoriumdiscounter\.nl)$/;

export function createWidgetAddress({ shopify, tunnelInfoUrl, fetchFn = fetch, graphql = adminGraphql }) {
    const state = { url: null, published: null, at: null, error: null };

    async function currentUrl() {
        const response = await fetchFn(tunnelInfoUrl, { signal: AbortSignal.timeout(5000) });
        const body = await response.json().catch(() => ({}));
        const url = body?.hostname ? `https://${String(body.hostname).toLowerCase()}` : null;
        if (!url || !SAFE_URL.test(url)) throw new Error('the tunnel did not give a usable address');
        return url;
    }

    // Checks the address and writes it to the shop when it changed. Never throws.
    async function update() {
        try {
            const url = await currentUrl();
            state.url = url;
            if (url === state.published) return state;
            const { shop } = await graphql(shopify, '{ shop { id } }');
            const data = await graphql(
                shopify,
                `mutation ($metafields: [MetafieldsSetInput!]!) {
                    metafieldsSet(metafields: $metafields) { userErrors { field message } }
                }`,
                { metafields: [{ ownerId: shop.id, namespace: NAMESPACE, key: KEY, type: 'url', value: url }] },
            );
            const problems = data?.metafieldsSet?.userErrors || [];
            if (problems.length) throw new Error(problems.map((p) => p.message).join('; '));
            Object.assign(state, { published: url, at: new Date().toISOString(), error: null });
            console.log(`Chat address put in the shop: ${url}`);
        } catch (error) {
            const denied = /access|scope|denied|permission/i.test(error.message);
            state.error = denied ? 'no-access' : error.message;
            console.log(`Chat address not put in the shop: ${error.message}`);
        }
        return state;
    }

    return { update, state };
}
