import { adminGraphql } from './shopifyClient.js';

// Saves the customer's partial shipping choice ("now" or "wait") for one order.
//   log = only written to the server log (testing, nothing changes in Shopify)
//   tag = a tag "chat-shipping-now" / "chat-shipping-wait" on the order (needs the write_orders permission)
// Later the warehouse (GoedGepickt) can act on this tag.
export async function saveShippingChoice(settings, { mode, orderId, orderName, choice }) {
    if (!['now', 'wait'].includes(choice)) throw new Error('Unknown shipping choice');
    const tag = `chat-shipping-${choice}`;

    if (mode === 'log') {
        console.log(`Shipping choice for ${orderName}: ${tag} (SPLIT_SHIPMENT_MODE=log, nothing saved in Shopify)`);
        return;
    }
    if (mode !== 'tag') throw new Error('Partial shipping is switched off');

    const data = await adminGraphql(
        settings,
        `mutation AddTag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`,
        { id: orderId, tags: [tag] },
    );
    if (data.tagsAdd.userErrors.length > 0) {
        throw new Error(`Could not save the shipping choice on ${orderName}: ${JSON.stringify(data.tagsAdd.userErrors)}`);
    }
    console.log(`Shipping choice for ${orderName}: ${tag} saved on the order`);
}
