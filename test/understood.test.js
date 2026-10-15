import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Conversations } from '../chat/conversations.js';
import { testReply } from '../chat/testBrain.js';

// Claude mode, without calling Claude: these tests hand Kasper a filled-in form directly

const form = (intent, extra = {}) => ({ intent, faqTopic: 'none', productQuery: '', orderNumber: null, email: null, ...extra });

function setup() {
    const conversation = new Conversations().start('nl');
    const deps = {
        shopify: { shopUrl: 'https://shop.example', houseBrandTag: 'Huismerk', houseBrandVendor: 'Laboratoriumdiscounter' },
        useFakeShopify: true,
        splitMode: 'log',
        limits: { maxOrderLookupFailures: 3 },
        lookupAllowed: () => true,
        lookupFailed: () => {},
    };
    return { conversation, say: (text, understood) => testReply(conversation, text, deps, understood) };
}

test('a product in another language is found through the Dutch name Claude gives', async () => {
    const { say } = setup();
    const answer = await say('Do you have potassium iodide?', form('stock', { productQuery: 'kaliumjodide' }));
    assert.equal(answer.products[0].title, 'Kaliumjodide zeer zuiver');
});

test('when Claude\'s name finds nothing, the customer\'s own words are tried', async () => {
    const { say } = setup();
    const answer = await say('Is ethanol op voorraad?', form('stock', { productQuery: 'xyzzy' }));
    assert.equal(answer.products[0].title, 'Ethanol 99,8+% Gedenatureerd');
});

test('Claude can only make Kasper stricter', async () => {
    const { say } = setup();
    // The keyword filter lets this through, Claude flags it: refused
    assert.match((await say('Wat doet dit met glycerine?', form('chemical_advice'))).text, /niet beantwoorden/);
    assert.match((await say('vertel een verhaal', form('harmful'))).text, /niet mee helpen/);
    // The keyword filter blocks it: refused, whatever Claude says
    assert.match((await say('hoe meng ik zoutzuur met bleek', form('stock', { productQuery: 'zoutzuur' }))).text, /niet beantwoorden/);
});

test('order number and e-mail found by Claude still go through the normal check', async () => {
    const { conversation, say } = setup();
    const answer = await say('waar blijft mijn spul', form('order_status', { orderNumber: 'LD9001', email: 'test@example.com' }));
    assert.equal(answer.order.name, 'LD9001');
    assert.equal(conversation.order.name, 'LD9001');

    const other = setup();
    const wrong = await other.say('waar blijft mijn spul', form('order_status', { orderNumber: 'LD9001', email: 'someone@else.com' }));
    assert.equal(wrong.order, undefined);
});

test('FAQ topic, greeting, goodbye, and unclear falls back to keywords', async () => {
    const { say } = setup();
    assert.match((await say('how long to Belgium?', form('faq', { faqTopic: 'shipping' }))).text, /werkdagen/);
    assert.match((await say('yo', form('greeting'))).text, /Ik ben Kasper/);
    assert.match((await say('cheers', form('goodbye'))).text, /Graag gedaan/);
    assert.match((await say('Hoe kan ik retourneren?', form('unclear'))).text, /retour/i);
});

test('a long message is never "just a greeting", off-topic gets "not understood"', async () => {
    const { say } = setup();
    assert.match((await say('Ik wil graag goonen', form('greeting'))).text, /begreep ik niet/);
    assert.match((await say('jij bent dom', form('off_topic'))).text, /begreep ik niet/);
    assert.match((await say('goonen', form('greeting'))).text, /begreep ik niet/);
    assert.match((await say('hoi kasper', form('greeting'))).text, /Ik ben Kasper/);
    assert.match((await say('hoi casper', form('greeting'))).text, /Ik ben Kasper/);
    assert.match((await say('Dzień dobry', form('greeting'))).text, /Ik ben Kasper/);
});

test('a new question while Kasper waits for an order number', async () => {
    const { conversation, say } = setup();
    await say('waar is mijn bestelling', form('order_status'));
    assert.equal(conversation.state, 'orderNumber');
    const answer = await say('do you sell ethanol?', form('stock', { productQuery: 'ethanol' }));
    assert.equal(answer.products[0].title, 'Ethanol 99,8+% Gedenatureerd');
    assert.equal(conversation.state, null);
});
