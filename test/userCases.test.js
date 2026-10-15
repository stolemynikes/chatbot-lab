import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Conversations } from '../chat/conversations.js';
import { testReply } from '../chat/testBrain.js';
import { contactSubject } from '../routes/chatRoute.js';

// The owner's user cases (2026-10-15). Every case runs twice: with keywords only (test mode, or when Claude is
// down) and with the form Claude fills in (claude mode, without calling Claude).
//
// To add a case: one line in `cases`. `form` is what Claude should fill in for that question.

const form = (intent, extra = {}) => ({ intent, faqTopic: 'none', productQuery: '', orderNumber: null, email: null, language: 'nl', ...extra });

function setup() {
    const conversation = new Conversations().start('nl');
    const deps = {
        shopify: { shopUrl: 'https://shop.example', houseBrandTag: 'Huismerk', houseBrandVendor: 'Laboratoriumdiscounter' },
        useFakeShopify: true,
        splitMode: 'off',
        limits: { maxOrderLookupFailures: 5 },
        lookupAllowed: () => true,
        lookupFailed: () => {},
    };
    return { conversation, say: (text, understood) => testReply(conversation, text, deps, understood) };
}

const cases = [
    // Een product kunnen opzoeken / voorraad vragen. Alleen de naam is genoeg.
    { question: 'Kaliumchloride', form: form('stock', { productQuery: 'kaliumchloride' }), expect: (a) => assert.equal(a.products[0].title, 'Kaliumchloride 99,5+%') },
    { question: 'kaliumchloride op voorraad?', form: form('stock', { productQuery: 'kaliumchloride' }), expect: (a) => assert.equal(a.products[0].title, 'Kaliumchloride 99,5+%') },
    { question: 'wat is de voorraad van dit', form: form('stock'), expect: (a, c) => { assert.equal(a.products, undefined); assert.equal(c.state, 'product'); } },

    // Vragen over verzending
    { question: 'Hoe lang duurt de verzending naar Duitsland?', form: form('faq', { faqTopic: 'shipping' }), expect: (a) => assert.match(a.text, /2–3 werkdagen/) },

    // Vragen over retourneren: chemicaliën niet, andere artikelen alleen in overleg
    { question: 'Kan ik mijn bestelling retourneren?', form: form('faq', { faqTopic: 'returns' }), expect: (a) => { assert.match(a.text, /Chemicaliën kunnen helaas niet retour/); assert.equal(a.contactTopic, 'returns'); } },

    // Vragen over mijn factuur: in het account onder "Facturen" en in de bestelling, met creditnota
    { question: 'Waar vind ik de factuur van mijn bestelling?', form: form('faq', { faqTopic: 'invoice' }), expect: (a) => { assert.match(a.text, /"Facturen"/); assert.match(a.text, /creditnota/); } },

    // Mijn bestelling annuleren: nooit zelf, altijd via het formulier
    { question: 'Ik wil mijn bestelling annuleren', form: form('faq', { faqTopic: 'cancel' }), expect: (a) => { assert.match(a.text, /kan ik niet zelf doen/); assert.equal(a.openContactForm, true); assert.equal(a.contactTopic, 'cancel'); } },

    // Doorgewezen worden naar het e-mailformulier
    { question: 'Ik wil een medewerker spreken', form: form('faq', { faqTopic: 'human' }), expect: (a) => { assert.equal(a.contactOffer, true); assert.equal(a.contactTopic, 'human'); } },
];

for (const item of cases) {
    test(`keywords: ${item.question}`, async () => {
        const { conversation, say } = setup();
        item.expect(await say(item.question), conversation);
    });
    test(`claude form: ${item.question}`, async () => {
        const { conversation, say } = setup();
        item.expect(await say(item.question, item.form), conversation);
    });
}

test('the contact form subject says what it is about, with the order number when Kasper knows it', async () => {
    const { conversation, say } = setup();
    const cancel = contactSubject(conversation, await say('Ik wil mijn bestelling annuleren'));
    assert.equal(cancel.contactTopic, 'cancel');
    assert.equal(cancel.contactSubjects.cancel, 'Bestelling annuleren');
    assert.equal(Object.keys(cancel.contactSubjects).at(-1), 'other'); // "Overige vraag" is last in the dropdown
    assert.equal(cancel.contactSubjects.other, 'Overige vraag');

    assert.equal(contactSubject(conversation, { text: 'x', contactOffer: true }).contactTopic, 'other');
    await say('waar is mijn bestelling LD9003 test@example.com');
    assert.equal(contactSubject(conversation, { text: 'x', contactOffer: true }).contactTopic, 'order'); // Kasper knows the order
    assert.deepEqual(contactSubject(conversation, { text: 'x' }), {}); // no contact button: no subject
});

test('a question about a discount code gets the volume discount answer (owner: fine as it is)', async () => {
    const { say } = setup();
    const answer = await say('Hebben jullie een kortingscode?');
    assert.match(answer.text, /staffelkorting/);
    assert.doesNotMatch(answer.text, /geen kortingscodes/);
});
