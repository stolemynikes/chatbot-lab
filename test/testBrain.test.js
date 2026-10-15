import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Conversations } from '../chat/conversations.js';
import { testReply } from '../chat/testBrain.js';
import { findOrderNumber, findEmail, summarizeOrder } from '../shopify/orders.js';
import { fakeOrders } from '../shopify/fixtures.js';

const limits = { maxOrderLookupFailures: 3 };

function setup(language = 'nl') {
    const conversations = new Conversations();
    const conversation = conversations.start(language);
    let ipFailures = 0;
    const deps = {
        shopify: { shopUrl: 'https://shop.example', houseBrandTag: 'Huismerk', houseBrandVendor: 'Laboratoriumdiscounter' },
        useFakeShopify: true,
        splitMode: 'log',
        limits,
        lookupAllowed: () => ipFailures < 10,
        lookupFailed: () => ipFailures++,
    };
    return { conversation, say: (text) => testReply(conversation, text, deps) };
}

test('order lookup asks for number and e-mail, then shows the order', async () => {
    const { conversation, say } = setup();
    assert.match((await say('Waar is mijn bestelling?')).text, /Wat is je ordernummer/);
    assert.match((await say('LD9001')).text, /e-mailadres/);
    const answer = await say('test@example.com');
    assert.match(answer.text, /LD9001 is verzonden/);
    assert.equal(answer.order.tracking[0].number, '00340434000000000001');
    assert.deepEqual(answer.order.items.map((item) => item.state), ['shipped']);
    assert.equal(answer.order.id, undefined); // the Shopify id never goes to the browser
    assert.equal(conversation.order.name, 'LD9001');
});

test('a wrong e-mail address shows nothing about the order', async () => {
    const { conversation, say } = setup();
    await say('waar is mijn order LD9001');
    const answer = await say('someone.else@example.com');
    assert.match(answer.text, /geen bestelling vinden/);
    assert.doesNotMatch(answer.text, /Ethanol|verzonden|GLS/);
    assert.equal(answer.order, undefined);
    assert.equal(conversation.order, null);
});

test('order lookups stop after too many failures', async () => {
    const { say } = setup();
    await say('waar is mijn bestelling');
    for (let i = 0; i < limits.maxOrderLookupFailures; i++) {
        await say(`LD900${i + 5}`);
        await say('wrong@example.com');
    }
    await say('LD9001');
    const answer = await say('test@example.com'); // right this time, but the brake is on
    assert.equal(answer.contactOffer, true);
    assert.doesNotMatch(answer.text, /verzonden/);
});

test('order number and e-mail in one message works', async () => {
    const { say } = setup('en');
    const answer = await say('Where is my order LD9003? My email is test@example.com');
    assert.match(answer.text, /LD9003 is being prepared/);
});

test('partially available order offers the partial shipping choice', async () => {
    const { say } = setup();
    await say('status bestelling LD9002 test@example.com');
    const answer = await say('waar is mijn bestelling');
    assert.deepEqual(
        answer.buttons.map((button) => button.id),
        ['split-now', 'split-wait'],
    );
    assert.deepEqual(
        answer.order.items.map((item) => [item.title, item.state]),
        [['Pipettips 10 µl', 'preparing'], ['Trechter Micro', 'backorder'], ['Toeslag kleine bestelling', 'preparing']],
    );
    assert.match(answer.question, /Niet alles uit je bestelling is op voorraad/);
});

test('blocked questions are refused even in the middle of an order lookup', async () => {
    const { conversation, say } = setup();
    await say('waar is mijn bestelling');
    const answer = await say('hoe meng ik zoutzuur met bleek');
    assert.match(answer.text, /niet beantwoorden/);
    assert.equal(conversation.state, null);
});

test('FAQ, stock check and not-understood answers', async () => {
    const { say } = setup();
    assert.match((await say('Hoe lang duurt de verzending?')).text, /werkdagen/);
    const stock = await say('Is ethanol op voorraad?');
    assert.deepEqual(
        stock.products.map((product) => [product.title, product.inStock]),
        [['Ethanol 99,8+% Gedenatureerd', true]],
    );
    const first = await say('blablabla');
    assert.ok(first.quickReplies.length > 0);
    assert.equal(first.contactOffer, undefined);
    assert.equal((await say('qwerty')).contactOffer, true);
});

test('finished answers ask "anything else?" and "no, thanks" says goodbye', async () => {
    const { say } = setup();
    const answer = await say('Hoe lang duurt de verzending?');
    assert.equal(answer.followUp, 'Kan ik je nog ergens anders mee helpen?');
    assert.ok(answer.quickReplies.includes('Nee, bedankt'));
    assert.match((await say('Nee, bedankt')).text, /Graag gedaan/);
    assert.match((await say('dank je wel!')).text, /Graag gedaan/);

    // While the bot waits for an order number there is no follow-up question
    assert.equal((await say('waar is mijn bestelling')).followUp, undefined);
});

test('a greeting is answered by Kasper, a greeting with a question gets the answer', async () => {
    const { say } = setup();
    for (const hello of ['hoi', 'Hallo!', 'goedemorgen', 'Hoi Kasper']) {
        assert.match((await say(hello)).text, /Ik ben Kasper/, hello);
    }
    assert.match((await say('hoi, waar is mijn bestelling?')).text, /Wat is je ordernummer/);
});

test('order numbers and e-mail addresses are read from sentences', () => {
    assert.equal(findOrderNumber('mijn order is #LD1004'), 'LD1004');
    assert.equal(findOrderNumber('order 1004'), 'LD1004');
    assert.equal(findOrderNumber('ORD1003'), 'ORD1003');
    assert.equal(findOrderNumber('jan1990@example.com'), null);
    assert.equal(findOrderNumber('waar is mijn bestelling'), null);
    assert.equal(findEmail('mail: Jan@Example.COM.'), 'jan@example.com');
    assert.equal(findEmail('geen mail'), null);
});

test('partial shipping is only offered when part can go now and part must wait', () => {
    assert.equal(summarizeOrder(fakeOrders[1]).canSplit, true);
    assert.equal(summarizeOrder(fakeOrders[2]).canSplit, false); // all in stock
    assert.equal(summarizeOrder({ ...fakeOrders[1], tags: ['chat-shipping-wait'] }).canSplit, false); // already chosen
    assert.equal(summarizeOrder({ ...fakeOrders[1], cancelledAt: '2026-10-11T00:00:00Z' }).canSplit, false);
});

test('product search finds one-word names typed as two words', async () => {
    const { say } = setup();
    const answer = await say('Kalium jodide op voorraad?');
    // Own brand first (even when out of stock), then the other matches
    assert.deepEqual(
        answer.products.map((product) => [product.title, product.houseBrand, product.inStock]),
        [
            ['Kaliumjodide zeer zuiver', true, false],
            ['Kaliumjodide 99,5+%', false, true],
        ],
    );
});

test('a new question while waiting for an order number is answered (no loop)', async () => {
    const { conversation, say } = setup();
    await say('Waar is mijn bestelling?');
    const stock = await say('Kalium Jodide op voorraad?');
    assert.equal(stock.products[0].title, 'Kaliumjodide zeer zuiver');
    assert.equal(conversation.state, null);
});

test('useless answers to the order question stop after two tries', async () => {
    const { conversation, say } = setup();
    await say('Waar is mijn bestelling?');
    assert.match((await say('a')).text, /geen geldig ordernummer/);
    const second = await say('a');
    assert.equal(second.contactOffer, true);
    assert.ok(second.quickReplies.length > 0);
    assert.equal(conversation.state, null);
    assert.doesNotMatch((await say('a')).text, /ordernummer/); // no longer asking
});

test('useless answers to the e-mail question also stop', async () => {
    const { conversation, say } = setup();
    await say('Waar is mijn bestelling LD9001');
    assert.match((await say('weet ik niet')).text, /geen geldig e-mailadres/);
    await say('nee');
    assert.equal(conversation.state, null);
});

test('"wat is de voorraad van dit" asks which product instead of guessing', async () => {
    for (const question of ['wat is de voorraad van dit', 'Hebben jullie dit op voorraad?', 'is this in stock?', 'Wat is de voorraad?']) {
        const { conversation, say } = setup();
        const answer = await say(question);
        assert.equal(answer.products, undefined, question);
        assert.equal(conversation.state, 'product', question);
    }
    // Then the customer names the product
    const { say } = setup();
    await say('wat is de voorraad van dit');
    assert.equal((await say('ethanol')).products[0].title, 'Ethanol 99,8+% Gedenatureerd');
});

test('filler words are never searched as a product name', async () => {
    const { productWords } = await import('../shopify/orders.js');
    assert.deepEqual(productWords('wat is de voorraad van dit'), ['voorraad']);
    assert.deepEqual(productWords('Is ethanol 99,8% nog op voorraad?'), ['ethanol', '99,8%', 'voorraad']);
    assert.deepEqual(productWords('Habt ihr Kaliumjodid?'), ['kaliumjodid']);
    assert.deepEqual(productWords('Do you have this one'), []);
    assert.deepEqual(productWords('heb je dat spul nog'), []);
});

test('after "which product?" a new question is answered, not searched as a product', async () => {
    const { conversation, say } = setup();
    assert.match((await say('Wat is de voorraad van dit')).text, /Over welk product gaat het/);
    const answer = await say('Retour');
    assert.match(answer.text, /Chemicaliën kunnen helaas niet retour/);
    assert.equal(answer.products, undefined);
    assert.equal(conversation.state, null);
});
