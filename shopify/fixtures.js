// Fake orders and products, used when SHOPIFY_CLIENT_ID is empty (and in the tests).
// Same shape as what Shopify's Admin API sends back.

const item = (title, quantity, unfulfilledQuantity, inventoryQuantity, tracked = true) => ({
    title,
    variantTitle: null,
    quantity,
    unfulfilledQuantity,
    variant: { inventoryQuantity, inventoryItem: { tracked } },
});

export const fakeOrders = [
    {
        id: 'gid://shopify/Order/9001',
        name: 'LD9001',
        email: 'test@example.com',
        createdAt: '2026-10-01T10:00:00Z',
        cancelledAt: null,
        tags: [],
        displayFulfillmentStatus: 'FULFILLED',
        displayFinancialStatus: 'PAID',
        totalPriceSet: { presentmentMoney: { amount: '24.20', currencyCode: 'EUR' } },
        lineItems: { nodes: [item('Ethanol 99,8+% Gedenatureerd (1 L)', 2, 0, 10)] },
        fulfillments: [
            { status: 'SUCCESS', trackingInfo: [{ number: '00340434000000000001', url: 'https://example.com/track/00340434000000000001', company: 'GLS' }] },
        ],
    },
    {
        // Part in stock, part not: the customer gets the partial shipping choice
        id: 'gid://shopify/Order/9002',
        name: 'LD9002',
        email: 'test@example.com',
        createdAt: '2026-10-10T10:00:00Z',
        cancelledAt: null,
        tags: [],
        displayFulfillmentStatus: 'UNFULFILLED',
        displayFinancialStatus: 'PAID',
        totalPriceSet: { presentmentMoney: { amount: '24.20', currencyCode: 'EUR' } },
        lineItems: {
            nodes: [
                item('Pipettips 10 µl', 1, 1, 25),
                item('Trechter Micro', 2, 2, -2),
                item('Toeslag kleine bestelling', 1, 1, -5, false),
            ],
        },
        fulfillments: [],
    },
    {
        id: 'gid://shopify/Order/9003',
        name: 'LD9003',
        email: 'test@example.com',
        createdAt: '2026-10-12T10:00:00Z',
        cancelledAt: null,
        tags: [],
        displayFulfillmentStatus: 'UNFULFILLED',
        displayFinancialStatus: 'PAID',
        totalPriceSet: { presentmentMoney: { amount: '24.20', currencyCode: 'EUR' } },
        lineItems: { nodes: [item('Katoenen handschoenen maat 10', 1, 1, 4)] },
        fulfillments: [],
    },
];

// One size (variant) of a product
const size = (sku, quantity, { tracked = true, forSale = true, adr = false } = {}) => ({
    sku,
    availableForSale: forSale,
    inventoryQuantity: quantity,
    inventoryItem: { tracked },
    transport: adr ? { value: 'ADR' } : null,
});

const product = (title, handle, vendor, group, sizes, extra = {}) => ({
    title,
    handle,
    vendor,
    tags: [],
    status: 'ACTIVE',
    deliveryGroup: group ? { value: group } : null,
    refillFrom: null,
    bulkSkus: null,
    bulkGroup: null,
    variants: { nodes: sizes },
    ...extra,
});

export const fakeProducts = [
    product('Ethanol 99,8+% Gedenatureerd', 'ethanol-99-8', 'Laboratoriumdiscounter', 'stock', [size('ETH-500', 12, { adr: true })]),
    product('Trechter Micro', 'trechter-micro', 'Carl Roth', 'roth', [size('TR-1', 0)]),
    product('Pipettips ROTILABO 10 µl', 'pipettips-10', 'Carl Roth', 'roth', [size('PT-10', 40)]),
    product('Kaliumjodide 99,5+%', 'kaliumjodide-99-5', 'Diverse merken', 'other', [size('KI-995', 3)]),
    // Own brand by tag (not by vendor): must still come first
    product('Kaliumjodide zeer zuiver', 'kaliumjodide-zz', 'Diverse merken', 'stock', [size('KI-ZZ', 0)], { tags: ['Huismerk'] }),
];

// Copy of the shop metafield custom.delivery_rules (2026-10-13)
export const fakeDeliveryRules = {
    zone: { NL: 'z1', BE: 'z1', DE: 'z2', DK: 'z2', AT: 'z2', FR: 'z2', PL: 'z2', LU: 'z2', ES: 'z3', IT: 'z3', PT: 'z3', SE: 'z3', CZ: 'z3', RO: 'z3', HU: 'z3', SK: 'z3', SI: 'z3', LT: 'z3', LV: 'z3', EE: 'z3', HR: 'z3', FI: 'z4', IE: 'z5', BG: 'z6', GR: 'z7' },
    default_zone: 'z3',
    stock_days: { z1: [1, 2], z2: [2, 3], z3: [3, 4], z4: [4, 6], z5: [5, 6], z6: [5, 8], z7: [6, 7] },
    far: ['IE', 'FI', 'BG', 'GR'],
    groups: {
        stock: { oos_weeks: [1, 2], oos_weeks_far: [2, 3] },
        roth: { days_plus: 3 },
        tci: { weeks: [1, 2], weeks_far: [2, 3] },
        other: { weeks: [1, 2], weeks_far: [2, 3] },
        slow: { weeks: [2, 4], weeks_far: [2, 4] },
    },
    few: 4,
    refill_days: 1,
    adr_days: 3,
};
