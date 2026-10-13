# Casper – Laboratoriumdiscounter chatbot

Customer service chat for the Shopify store. Casper answers a fixed set of questions (order status, stock and
delivery time, shipping, returns, invoices, payment) and refuses questions about using, mixing or making chemicals.
When a customer is stuck, Casper offers a contact form that goes to info@.

**Status (2026-10-13): works on this computer against the test store. Not live, nothing is on the website yet.**

---

## To do

### 🔴 Before going live (must)

| # | What | Why / notes |
|---|---|---|
| 1 | **Fill in every `[INVULLEN]`** in `content/faq.js` | Shipping times, return policy, invoices, payment methods, who may order, phone/opening hours. Casper shows these texts word for word. |
| 2 | **Fixed Cloudflare tunnel** with an own address and HTTPS | Test: quick tunnel (random address, changes after a restart), see `docs/synology-nl.md`. For live: put the domain on Cloudflare and use a fixed tunnel like the invoice app, e.g. `chat.laboratoriumdiscounter.nl`. |
| 3 | ✅ ~~Only trust `Cf-Connecting-IP` behind the tunnel~~ | Done: `TRUST_CLOUDFLARE` (set by docker-compose.yml). |
| 4 | ✅ ~~Switch off the test page~~ | Done: `SHOW_TEST_PAGE=false` (set by docker-compose.yml). |
| 5 | **Security: bot check on the contact form** | Limit per visitor (5 per hour) is done. Still to do: Cloudflare Turnstile, before going live (not needed in the password-protected test store). |
| 6 | ✅ ~~Retention for contact requests~~ | Done: deleted after `CONTACT_RETENTION_DAYS` (90). |
| 7 | **Contact e-mail**: mailbox at Hostnet, `EMAIL_ENABLED=true`, SMTP settings in `.env` | Now contact requests are only saved as files in `data/contact-requests/`. |
| 8 | **`ALLOWED_ORIGINS`** in `.env`: the live shop's domains | Test store: `https://hevjuq-bg.myshopify.com`. Other websites get 403. |
| 9 | **Anthropic console**: monthly spend limit, allow only Haiku 5.5 for this key | So costs can never run away. |
| 10 | **Test list** of 200–300 questions (all languages, typos, slang, rude messages, misuse) | Measures how often Casper understands correctly before customers see it. Also compares Haiku with Sonnet. |
| 11 | **Check delivery times against the product pages** | Casper uses the theme's own logic; owner expected 2–3 working days for own brand, Casper often says 1–2. Compare a few products. |
| 12 | **VAT check in Shopify**: prices are entered *without* VAT (`taxesIncluded: false`), the website says "incl. btw" | One of the two is wrong. Also matters for the invoice app (test order LD1004 had 0% VAT). Casper shows prices without "incl./excl." until this is clear. |
| 13 | **Put the widget on the website** (theme app extension or script tag) | **Only with the owner's OK.** First on the test store. |
| 14 | **Test on real phones** (iPhone + Android) | Keyboard behaviour, smoothness of the animations, does the chat button overlap the theme's sticky "add to cart" bar. |

### 🟡 Soon (wanted)

| # | What | Notes |
|---|---|---|
| 15 | **Better product search (own search index)** | Search by CAS number (`7681-11-0`), SKU, typos, synonyms. 19,203 products; CAS is in `custom.cas` and tags. |
| 16 | **All EU languages** | Translate the fixed texts once (after #1), owner checks them. Now: NL, EN, DE, FR; other languages get English. |
| 17 | **Reply time** in the contact form and thank-you text | e.g. "usually within 1 working day" – only if you can keep that promise. |
| 18 | **Remember the chat across pages** | Then product links can open in the same tab instead of a new one. |

### 🔵 Later

| # | What | Notes |
|---|---|---|
| 19 | **SDS / CoA links** | Through the existing SDS app (`custom.msds_sheets`, `custom.coa`). |
| 20 | **Partial shipping via GoedGepickt** | Now only `SPLIT_SHIPMENT_MODE=log`. Decide: extra shipping costs for the 2nd parcel? `tag` mode needs `write_orders`. The cart text says orders ship at once when everything is in stock – align that. |
| 21 | **Logged-in customers** | Show their orders without asking order number + e-mail. |
| 22 | **Orders older than 60 days** | Needs the `read_all_orders` permission from Shopify. |

### Keep in mind

- `shopify/delivery.js` is a copy of the theme's delivery logic (`snippets/lab-delivery-calc.liquid`, `blocks/house-badge.liquid`).
  **When the theme's delivery logic changes, change this file too.** The times themselves come from the shop metafield
  `custom.delivery_rules` and update by themselves.
- The stock/delivery texts in `public/widget.js` are copied from the theme's `locales/*.json` (`lab.stock`).

---

## Start

1. Copy `.env.example` to `.env` and fill it in. Leave `SHOPIFY_CLIENT_ID` empty to use fake test orders
   (`LD9001`–`LD9003`, e-mail `test@example.com`).
2. `node scripts/checkShopify.js` – read-only connection test (shows the permissions).
3. `npm.cmd start` and open http://localhost:8090/test.html
   On the NAS (test, own network only): see `docs/synology-nl.md`. Package for the NAS: `node scripts/makeNasPackage.js`.
4. `npm.cmd test` – runs all tests (no internet or API costs needed).

On Windows PowerShell, `npm` may be blocked; use `npm.cmd`.

## Settings (`.env`)

| Setting | Meaning |
|---|---|
| `CHAT_MODE` | `test` = keywords only, free. `claude` = Claude reads the question (see below). |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Claude key and model (`claude-haiku-5-5`). |
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` | Own Dev Dashboard app "Chatbot", permissions `read_orders, read_products, read_inventory, read_themes`. |
| `SHOP_URL` | Shop address for product links. |
| `HOUSE_BRAND_TAG`, `HOUSE_BRAND_VENDOR` | Own brand ("Huismerk"): always first, with the logo. |
| `SPLIT_SHIPMENT_MODE` | `off` / `log` / `tag` (see #20). |
| `ALLOWED_ORIGINS` | Shop domains that may use the chat. |
| `CONTACT_EMAIL_TO`, `EMAIL_ENABLED`, `SMTP_*` | Where contact requests go. |

## How it works

```
customer message
   │
   ▼
1. Safety filter (safety/guard.js, no AI) ── blocked ──► fixed refusal / 112 / helpline
   │
   ▼
2. Claude fills in a form (chat/interpreter.js): topic, product name in Dutch, order number, e-mail, language
   │   (Claude never writes text for the customer; when Claude is not available: keywords)
   ▼
3. Casper answers (chat/testBrain.js) with fixed texts + cards:
   order card · product cards (own brand first, stock + delivery time like the website) · FAQ · contact form
```

- **Claude can only make Casper stricter.** It can flag a message as chemical advice, harmful or off-topic, but it can
  never unlock something the safety filter blocked, and every field it fills in is checked again.
- **Orders** are only shown when order number AND e-mail address match. Max 5 failed tries per conversation and
  10 per visitor per hour. Casper never says which of the two was wrong, and shows no address or payment details.
- **Languages**: Casper starts in the website's language and switches when the customer writes in another one
  (NL/EN/DE/FR; others get English). The flag button (▾) lets the customer choose.
- **Widget** (`public/widget.js`): all text is shown as plain text (never as code); only `https://` links and
  `cdn.shopify.com` pictures. Full screen on phones, typing dots and small animations, less motion when the visitor asks for it.
- **Conversations** live in memory only and disappear after 2 hours without activity.

## Files

| File | What |
|---|---|
| `index.js`, `config.js` | Server and settings |
| `routes/chatRoute.js` | Chat API: start, message, language, partial shipping, contact |
| `safety/guard.js` | Safety filter |
| `safety/texts.js` | Fixed texts per language (refusals, order texts, buttons) |
| `content/faq.js` | Answers to the fixed questions – **fill in `[INVULLEN]`** |
| `chat/interpreter.js` | Claude: message → form |
| `chat/testBrain.js` | Casper's answers |
| `shopify/orders.js` | Order lookup, product search |
| `shopify/delivery.js` | Stock label and delivery time (copy of the theme logic) |
| `public/widget.js` | The chat window on the website |
| `test/` | Tests |
