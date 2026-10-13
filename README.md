# Laboratoriumdiscounter chatbot

Customer service chat for the Shopify store. It answers a fixed set of questions
(order status, shipping, returns, invoices, payment, stock) and refuses questions about
using, mixing or making chemicals. When the customer is stuck, it offers a contact form that goes to info@.

## Modes

- `CHAT_MODE=test` (now): fixed answers and keywords, no AI, free.
- `CHAT_MODE=claude`: Claude (`CLAUDE_MODEL`, default Haiku 5.5) only reads the question and fills in a form (topic, product name in Dutch, order number, e-mail). Casper still answers with the same fixed texts and cards, after the same safety filter and Shopify checks. Claude can only make Casper stricter (it can flag a message as chemical advice or harmful). When Claude is not reachable, Casper answers with keywords like in test mode. See `chat/interpreter.js`.

## Start

1. Copy `.env.example` to `.env` and fill it in (leave `SHOPIFY_CLIENT_ID` empty for fake test orders LD9001-LD9003, e-mail test@example.com).
2. `node scripts/checkShopify.js` - read-only connection test.
3. `npm.cmd start` and open http://localhost:8090/test.html
4. `npm.cmd test` - runs all tests.

## Safety

- **Safety filter** (`safety/guard.js`): checks every message before anything else, without AI. Refuses chemical
  advice (mixing, making, dosing, effects, storage, disposal), weapons, drugs, poisoning, getting around rules and
  attempts to change the bot's rules. Accidents get 112 / doctor / SDS section 4; self-harm gets helpline numbers.
  It is strict on purpose: a wrong refusal still ends with the contact form.
- **Orders**: only shown when order number AND e-mail address match. Max 5 failed tries per conversation and
  10 per visitor per hour. The answer never tells which of the two was wrong. No address or payment details are shown.
- **Shopify app**: own Dev Dashboard app with only `read_orders, read_products, read_inventory`.
  `write_orders` is only needed when `SPLIT_SHIPMENT_MODE=tag`.
- **Widget**: shows all text with `textContent`, so nothing can run as code on the shop.
- Conversations live in memory only and disappear after 2 hours without activity.

## Fixed texts

- `content/faq.js`: the answers to the fixed questions. Fill in every `[INVULLEN]`.
- `safety/texts.js`: refusals, order texts, buttons (nl, en, de, fr; other languages fall back to English).

## Partial shipping

When part of an unshipped, paid order is out of stock (Shopify "available" below zero), the customer can choose
"send what is in stock now" or "send everything together". `SPLIT_SHIPMENT_MODE`:
`off` / `log` (only the server log) / `tag` (tag `chat-shipping-now` or `chat-shipping-wait` on the order, for GoedGepickt later).
The bot never mentions extra shipping costs.
