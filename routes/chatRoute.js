import express from 'express';

import { pickLanguage, t } from '../safety/texts.js';
import { cleanEmail } from '../shopify/orders.js';
import { saveShippingChoice } from '../shopify/shippingChoice.js';
import { finished } from '../chat/testBrain.js';
import { rateLimit, visitorBrake, visitorKey } from './rateLimit.js';

// The chat API used by the widget:
//   POST /api/chat/start    { language }                       -> welcome message + conversation id
//   POST /api/chat/message  { conversationId, text }           -> the bot's answer
//   POST /api/chat/action   { conversationId, action }         -> partial shipping buttons
//   POST /api/chat/contact  { conversationId, name, email, message } -> contact form
// The subject dropdown of the contact form: its texts, and the subject that fits the question
// ("cancel" after "I want to cancel my order"; "order" when Kasper knows the order; otherwise "other")
export function contactSubject(conversation, answer) {
    if (!answer.contactOffer) return {};
    const subjects = t(conversation.language).subjects;
    const topic = subjects[answer.contactTopic] ? answer.contactTopic : conversation.order ? 'order' : 'other';
    return { contactTopic: topic, contactSubjects: subjects };
}

export function createChatRoute({ conversations, reply, settings, sendContactRequest }) {
    const router = express.Router();
    const lookupBrake = visitorBrake({ max: 10, minutes: 60, label: 'Order lookups blocked' });
    const contactBrake = visitorBrake({ max: 5, minutes: 60, label: 'Contact requests blocked' });

    router.use(express.json({ limit: '10kb' }));
    router.use(rateLimit({ max: 30, minutes: 1 }));

    // Every route except /start needs an existing conversation
    const findConversation = (req, res) => {
        const conversation = conversations.get(req.body?.conversationId);
        if (!conversation) res.status(404).send({ message: 'Conversation expired, please start a new one' });
        return conversation;
    };

    router.post('/start', (req, res) => {
        const conversation = conversations.start(pickLanguage(req.body?.language), String(req.body?.country || '').toUpperCase());
        const words = t(conversation.language);
        conversation.transcript.push({ from: 'bot', text: words.welcome });
        res.send({ conversationId: conversation.id, text: words.welcome, quickReplies: words.topics, contactLabel: words.contactButton });
    });

    router.post('/message', async (req, res) => {
        const conversation = findConversation(req, res);
        if (!conversation) return;
        const words = t(conversation.language);

        const text = typeof req.body.text === 'string' ? req.body.text.trim().slice(0, settings.limits.maxMessageLength) : '';
        if (!text) return res.status(400).send({ message: 'Empty message' });

        conversation.messageCount += 1;
        if (conversation.messageCount > settings.limits.maxMessagesPerConversation) {
            return res.send({ text: words.conversationLimit, contactOffer: true });
        }

        const key = visitorKey(req);
        const deps = {
            shopify: settings.shopify,
            useFakeShopify: settings.useFakeShopify,
            splitMode: settings.splitMode,
            limits: settings.limits,
            lookupAllowed: () => lookupBrake.allowed(key),
            lookupFailed: () => lookupBrake.count(key),
        };

        try {
            conversation.transcript.push({ from: 'customer', text });
            const answer = await reply(conversation, text, deps);
            // Product cards are written out in the transcript, so the contact e-mail shows what the customer saw
            const cards = [
                ...(answer.products || []).map((product) => `\n• ${product.title} (${{ in: 'op voorraad', avail: 'leverbaar', out: 'niet op voorraad' }[product.stock] ?? 'niet te koop'})`),
                ...(answer.order?.items || []).map((item) => `\n• ${item.quantity}× ${item.title}${item.variant ? ` (${item.variant})` : ''} [${item.state}]`),
                answer.question ? `\n${answer.question}` : '',
            ].join('');
            conversation.transcript.push({ from: 'bot', text: answer.text + cards });
            res.send({ ...answer, ...contactSubject(conversation, answer), language: conversation.language, contactLabel: t(conversation.language).contactButton });
        } catch (error) {
            console.log(`Chat error: ${error.stack || error.message}`);
            res.status(500).send({ text: words.lookupError, contactOffer: true });
        }
    });

    // The customer picks another language in the menu: the conversation goes on in that language
    router.post('/language', (req, res) => {
        const conversation = findConversation(req, res);
        if (!conversation) return;
        conversation.language = pickLanguage(req.body.language);
        const words = t(conversation.language);
        conversation.transcript.push({ from: 'bot', text: words.languageSwitched });
        res.send({ text: words.languageSwitched, quickReplies: words.topics, language: conversation.language, contactLabel: words.contactButton });
    });

    // Partial shipping. Only for the order this conversation has verified, and only when it is possible.
    router.post('/action', async (req, res) => {
        const conversation = findConversation(req, res);
        if (!conversation) return;
        const words = t(conversation.language);
        const choice = { 'split-now': 'now', 'split-wait': 'wait' }[req.body.action];
        const order = conversation.order;

        if (!choice || !order || !order.canSplit || settings.splitMode === 'off') {
            return res.send({ text: words.splitNotPossible, contactOffer: true });
        }
        try {
            await saveShippingChoice(settings.shopify, { mode: settings.splitMode, orderId: order.id, orderName: order.name, choice });
            order.canSplit = false; // one choice per order
            const text = choice === 'now' ? words.splitSavedNow : words.splitSavedWait;
            conversation.transcript.push({ from: 'customer', text: `[${choice === 'now' ? words.splitNow : words.splitWait}]` }, { from: 'bot', text });
            res.send(finished({ text }, words));
        } catch (error) {
            console.log(`Saving shipping choice failed: ${error.message}`);
            res.send({ text: words.splitNotPossible, contactOffer: true });
        }
    });

    router.post('/contact', async (req, res) => {
        const conversation = findConversation(req, res);
        if (!conversation) return;
        const words = t(conversation.language);

        // At most 2 per conversation, and 5 per visitor per hour (also when someone keeps starting new conversations)
        const visitor = visitorKey(req);
        if (conversation.contactRequests >= settings.limits.maxContactRequestsPerConversation || !contactBrake.allowed(visitor)) {
            return res.send({ text: words.contactLimit });
        }

        // Keep line breaks out of the name and e-mail (they end up in the e-mail headers)
        const name = String(req.body.name || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 100);
        const email = cleanEmail(req.body.email);
        const message = String(req.body.message || '').trim().slice(0, 3000);
        // Only a subject from the list (no free text in the e-mail subject line), plus the order Kasper knows
        const subjects = t(conversation.language).subjects;
        const topic = Object.hasOwn(subjects, req.body.topic) ? req.body.topic : 'other';
        const subject = conversation.order ? `${subjects[topic]} (${conversation.order.name})` : subjects[topic];
        if (!name || !email || !message) return res.status(400).send({ text: words.badEmail });

        conversation.contactRequests += 1;
        contactBrake.count(visitor);
        try {
            await sendContactRequest({ name, email, subject, message, conversation });
            res.send({ text: words.contactThanks });
        } catch (error) {
            console.log(`Contact request failed: ${error.message}`);
            conversation.contactRequests -= 1;
            res.status(500).send({ text: words.contactError });
        }
    });

    return router;
}
