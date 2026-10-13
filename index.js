import express from 'express';

import { PORT, CHAT_MODE, claude, ALLOWED_ORIGINS, shopify, useFakeShopify, SPLIT_SHIPMENT_MODE, contact, limits } from './config.js';
import { Conversations } from './chat/conversations.js';
import { testReply } from './chat/testBrain.js';
import { createClaudeReply } from './chat/claudeBrain.js';
import { createContactSender } from './email/contactRequest.js';

//routes import
import { createChatRoute } from './routes/chatRoute.js';

//check the settings before starting
const problems = [];
if (!['test', 'claude'].includes(CHAT_MODE)) problems.push('CHAT_MODE must be test or claude');
if (CHAT_MODE === 'claude' && !claude.apiKey.startsWith('sk-ant-')) problems.push('CHAT_MODE=claude needs ANTHROPIC_API_KEY (starts with sk-ant-)');
if (!useFakeShopify && (!shopify.storeDomain || !shopify.clientSecret)) problems.push('SHOPIFY_STORE_DOMAIN and SHOPIFY_CLIENT_SECRET must be filled in');
if (!['off', 'log', 'tag'].includes(SPLIT_SHIPMENT_MODE)) problems.push('SPLIT_SHIPMENT_MODE must be off, log or tag');
if (contact.email.enabled && (!contact.email.host || !contact.email.user || !contact.email.password || !contact.email.from)) {
    problems.push('EMAIL_ENABLED=true, but SMTP_HOST, SMTP_USER, SMTP_PASSWORD or EMAIL_FROM is missing');
}
if (problems.length > 0) {
    console.log('Please fix these settings in your .env file first:');
    problems.forEach((problem) => console.log(`  - ${problem}`));
    process.exit(1);
}

const app = express();
// Behind Cloudflare Tunnel or another proxy: use the visitor's real IP address for the rate limit
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Protection headers on every answer
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' https://cdn.shopify.com; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
        'Cross-Origin-Resource-Policy': 'cross-origin', // the widget script is loaded by the shop website
    });
    next();
});

// Only the shop's own website may talk to the chat API from a browser
app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

//HTTPS ROUTES
app.use(
    '/api/chat',
    createChatRoute({
        conversations: new Conversations({ idleMinutes: limits.conversationIdleMinutes }),
        reply: CHAT_MODE === 'claude' ? createClaudeReply(claude) : testReply,
        settings: { shopify, useFakeShopify, splitMode: SPLIT_SHIPMENT_MODE, limits },
        sendContactRequest: createContactSender(contact),
    }),
);

// The widget (widget.js) and a test page (test.html)
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Chatbot running on http://localhost:${PORT}/test.html`);
    console.log(`Mode: ${CHAT_MODE}${CHAT_MODE === 'claude' ? ` (${claude.model})` : ''}, Shopify: ${useFakeShopify ? 'fake test orders' : shopify.storeDomain}, partial shipping: ${SPLIT_SHIPMENT_MODE}, contact: ${contact.email.enabled ? `e-mail to ${contact.to}` : `files in ${contact.saveDir}`}`);
});
