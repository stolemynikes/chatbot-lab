import express from 'express';

import { PORT, CHAT_MODE, claude, ALLOWED_ORIGINS, TRUST_CLOUDFLARE, SHOW_TEST_PAGE, shopify, useFakeShopify, SPLIT_SHIPMENT_MODE, contact, limits } from './config.js';
import { Conversations } from './chat/conversations.js';
import { testReply } from './chat/testBrain.js';
import { createClaudeReply } from './chat/claudeBrain.js';
import { createContactSender, deleteOldContactRequests } from './email/contactRequest.js';
import { setTrustCloudflare } from './routes/rateLimit.js';

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
// Behind the Cloudflare Tunnel: use the visitor's real IP address for the brakes. Without the tunnel nothing is
// trusted, so nobody can fake an address with a header.
app.set('trust proxy', TRUST_CLOUDFLARE ? 1 : false);
setTrustCloudflare(TRUST_CLOUDFLARE);
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

// Only the shop's own website may talk to the chat API (and the health check) from a browser
app.use(['/api', '/health'], (req, res, next) => {
    const origin = req.get('origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' });
    } else if (origin && ALLOWED_ORIGINS.length > 0 && !(SHOW_TEST_PAGE && origin === `${req.protocol}://${req.get('host')}`)) {
        // Another website tries to use the chat (on our costs): refuse
        return res.sendStatus(403);
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

// For Container Manager's health check
app.get('/health', (req, res) => res.send('ok'));

// The test page only when switched on (not when the app can be reached from the internet)
if (!SHOW_TEST_PAGE) app.use(['/test.html', '/test-lang.js'], (req, res) => res.sendStatus(404));

// The widget (widget.js) and the test page (test.html)
app.use(express.static('public'));

// Saved contact requests are deleted after CONTACT_RETENTION_DAYS (now, and then once a day)
deleteOldContactRequests(contact);
setInterval(() => deleteOldContactRequests(contact), 24 * 60 * 60 * 1000).unref();

app.listen(PORT, () => {
    console.log(`Chatbot running on port ${PORT}${SHOW_TEST_PAGE ? `, test page: http://localhost:${PORT}/test.html` : ' (test page off)'}`);
    if (TRUST_CLOUDFLARE) console.log('Behind the Cloudflare Tunnel: visitor addresses come from Cloudflare');
    if (ALLOWED_ORIGINS.length > 0) console.log(`Chat allowed on: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`Mode: ${CHAT_MODE}${CHAT_MODE === 'claude' ? ` (${claude.model})` : ''}, Shopify: ${useFakeShopify ? 'fake test orders' : shopify.storeDomain}, partial shipping: ${SPLIT_SHIPMENT_MODE}, contact: ${contact.email.enabled ? `e-mail to ${contact.to}` : `files in ${contact.saveDir}`}`);
});
