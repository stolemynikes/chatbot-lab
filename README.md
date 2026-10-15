# Kasper – the Laboratoriumdiscounter chatbot

Kasper is the chat assistant for the Shopify store. He helps customers with:

- **Where is my order?** – status, items and track & trace (only after order number + e-mail address)
- **Is it in stock?** – product cards with stock, delivery time and price, exactly like the website, own brand first
- **Fixed questions** – shipping, returns, invoices, payment, account, business customers
- **Talking to a person** – a contact form that goes to info@

Kasper **refuses questions about using, mixing, making or dosing chemicals**, and anything about weapons, drugs or
hurting people. For accidents he gives 112 / a doctor / section 4 of the safety data sheet.

Claude (an AI model) only *reads* the customer's question. Kasper always answers with fixed, checked texts – never
with text written by the AI.

---

## Where we are now (2026-10-13)

✅ **Kasper works in the test store** (`hevjuq-bg.myshopify.com`, behind the store password – customers see nothing).

```
test store ──loads widget.js──> Cloudflare quick tunnel (https) ──> Kasper on the NAS (Docker)
                                                                       ├─> Shopify API (read only)
                                                                       └─> Claude API (Haiku 5.5)
```

| What | Where |
|---|---|
| Kasper runs on | Synology NAS → Container Manager → project **`casper`** (`/volume1/docker/casper`) |
| Address | A random `https://….trycloudflare.com` address – see the log of the container **`casper-tunnel`** |
| In the test store | One line above `</body>` in `layout/theme.liquid`: `<script src="https://<address>/widget.js" defer></script>` |
| Settings | `docker/casper/.env` on the NAS |
| Step-by-step guide | [`docs/synology-nl.md`](docs/synology-nl.md) (in Dutch) |

### Day to day during the test

| I want to… | Do this |
|---|---|
| **Put a new version on the NAS** | On the PC: `node scripts/makeNasPackage.js` → upload the contents of `build/casper-nas.zip` to `docker/casper` (not `.env`) → Container Manager → Project → `casper` → **Stop** → **Clean** → Image `casper-casper` **Delete** → Project **Build**. ⚠️ Without deleting the image, Container Manager keeps running the old version. |
| **Change a setting** | Edit `.env` → upload → Project → `casper` → **Stop** → **Build**. ⚠️ *Restart* is not enough: Docker only reads `.env` again on Build. |
| **The chat button is gone from the store** | The NAS or the project restarted, so the tunnel has a **new address**. Look it up in the log of `casper-tunnel` and replace it in `theme.liquid`. |
| **See contact requests** | E-mail is still off. Container `casper` → **Open terminal** → `ls /tmp/contact-requests` (they are lost after a Build). |
| **Check that Kasper runs** | `https://<address>/health` shows **ok**. The log of `casper` shows the settings it started with. |
| **Stop the test** | Project `casper` → **Stop**, and remove the line from `theme.liquid`. The store keeps working. |
| **Keep an eye on costs** | console.anthropic.com → Usage. Each question costs a fraction of a cent. |

### Testing on this PC

```
npm.cmd start                       # then open http://localhost:8090/test.html
npm.cmd test                        # all tests (free, no internet needed)
node scripts/checkShopify.js        # read-only connection test, shows the permissions
```

Leave `SHOPIFY_CLIENT_ID` empty in `.env` to use fake orders (`LD9001`–`LD9003`, e-mail `test@example.com`).
On Windows PowerShell, use `npm.cmd` instead of `npm`.

---

## Going live – step by step

Do these in order. **Nothing goes live without the owner's explicit OK.**

### Step 1 – Texts (owner)

- [x] **Fixed answers** in `content/faq.js` filled in from the shop's own texts (theme, contact page, delivery rules,
      surcharge, volume discount). **Owner: read them once** – Kasper shows them word for word.
- [ ] **Return policy** – the only `[INVULLEN]` left. It is in the shop's policies, which the app may not read
      (needs the `read_legal_policies` permission, or paste the text).
- [x] **Reply time** "usually within 24 hours" (same as the contact page).
- [ ] **Check the delivery times** Kasper shows against a few product pages (own brand, Carl Roth, out of stock).
      Kasper uses the theme's own logic; if something differs, tell us which product.
- [ ] **VAT**: Shopify says prices are entered *without* VAT (`taxesIncluded: false`), the website says "incl. btw".
      One of the two is wrong – check with the accountant. (Also matters for the invoice app.)

### Step 2 – Accounts and addresses

- [ ] **Domain on Cloudflare** (free plan): add `laboratoriumdiscounter.nl` and move the nameservers. The website keeps working.
- [ ] **Fixed tunnel** with its own address, e.g. `chat.laboratoriumdiscounter.nl` (Zero Trust → Networks → Tunnels),
      instead of the quick tunnel. The address then never changes.
- [ ] **Cloudflare rules**: only let Kasper's paths through (`/widget.js`, `/api/chat/…`, `/health`), rate limiting,
      Bot Fight Mode, Always Use HTTPS – like the invoice app (see its guide).
- [ ] **Own DSM user** for Kasper (no admin rights), set in `docker-compose.yml` (`user:`), like the invoice app.
- [ ] **Hostnet mailbox** for the contact form (or send from an existing one) + **SPF/DKIM**, so the mails don't land in spam.
- [ ] **Anthropic**: a separate **production key**, a **monthly spend limit**, and only Haiku 5.5 allowed for that key.
- [ ] **Shopify app on the live store**: same Dev Dashboard app, installed on the live store, with
      `read_orders, read_products, read_inventory, read_themes`.

### Step 3 – Settings for live (`.env` on the NAS)

| Setting | Live value |
|---|---|
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` | the live store and its app |
| `SHOP_URL` | `https://laboratoriumdiscounter.nl` |
| `ALLOWED_ORIGINS` | `https://laboratoriumdiscounter.nl,https://www.laboratoriumdiscounter.nl` |
| `ANTHROPIC_API_KEY` | the production key |
| `EMAIL_ENABLED`, `SMTP_*`, `EMAIL_FROM`, `CONTACT_EMAIL_TO` | on, with the Hostnet mailbox, to info@ |
| `SPLIT_SHIPMENT_MODE` | **`off`** (until GoedGepickt – in `log` mode Kasper says "noted" while nothing happens) |
| `CLOUDFLARE_TUNNEL_TOKEN` | the token of the fixed tunnel (new setting, comes with the fixed tunnel) |

`TRUST_CLOUDFLARE=true` and `SHOW_TEST_PAGE=false` are already set by `docker-compose.yml`.

### Step 4 – Last safety work (developer)

- [ ] **Bot check on the contact form** (Cloudflare Turnstile, invisible). The limit per visitor (5 per hour) is already there.
- [ ] **docker-compose.yml for live**: fixed tunnel with token, own DSM user, a folder for data if needed.
- [ ] **Test list**: 200–300 questions in all languages, with typos, slang, rude messages and misuse attempts.
      Shows how often Kasper understands correctly, and which questions go wrong.

### Step 5 – Test the live setup

- [ ] Kasper in the **test store** with the fixed address: all questions, orders, stock, contact form (the e-mail must arrive at info@).
- [ ] On **real phones** (iPhone and Android): keyboard, animations, does the chat button overlap the theme's sticky "add to cart" bar.
- [ ] A few **real customer questions** from the last months: does Kasper handle them well?

### Step 6 – Live (only with the owner's OK)

- [ ] Add the script line to the **live theme** (or an app embed that can be switched on/off in the theme editor).
- [ ] First week: read the log of `casper` daily (blocked questions, errors), check the costs, read the contact requests.
- [ ] **Undo** = remove the script line from the theme. The store keeps working; Kasper simply disappears.

---

## Later (after going live)

| What | Notes |
|---|---|
| **Better product search** | Search by CAS number (`7681-11-0`), SKU and synonyms. The store has 19,203 products; CAS is in `custom.cas` and the tags. |
| **All EU languages** | Translate the fixed texts once (after step 1), someone who speaks the language checks them. Now: NL, EN, DE, FR; other languages get English. |
| **SDS / CoA links** | Through the existing SDS app (`custom.msds_sheets`, `custom.coa`). |
| **Partial shipping via GoedGepickt** | Decide first: extra shipping costs for the second parcel? `SPLIT_SHIPMENT_MODE=tag` needs the `write_orders` permission. The cart text says orders ship at once when everything is in stock – align that. |
| **Remember the chat across pages** | Then product links can open in the same tab. |
| **Logged-in customers** | Show their orders without asking order number + e-mail. |
| **Orders older than 60 days** | Needs the `read_all_orders` permission from Shopify. |

### Keep in mind

- `shopify/delivery.js` is a **copy of the theme's delivery logic** (`snippets/lab-delivery-calc.liquid`,
  `blocks/house-badge.liquid`). When that logic changes in the theme, change this file too. The times themselves come
  from the shop metafield `custom.delivery_rules` and update by themselves (within 10 minutes).
- The stock and delivery texts in `public/widget.js` are copied from the theme's `locales/*.json` (`lab.stock`).

---

## How Kasper works

```
customer message
   │
   ▼
1. Safety filter (safety/guard.js, no AI) ── blocked ──► fixed refusal / 112 / helpline
   │
   ▼
2. Claude fills in a form (chat/interpreter.js):
   topic · product name in Dutch · order number · e-mail · language
   (Claude never writes text for the customer. When Claude is not available, keywords are used.)
   │
   ▼
3. Kasper answers (chat/testBrain.js) with fixed texts and cards:
   order card · product cards · fixed answers · contact form
```

### Safety

- **Safety filter first.** Every message goes through a fixed filter without AI. What it blocks, Claude never sees.
  It is strict on purpose: a wrong refusal still ends with the contact form.
- **Claude can only make Kasper stricter.** It can mark a message as chemical advice, harmful or off-topic, but never
  unlock something the filter blocked. Everything it fills in is checked again like customer input.
- **Orders** are only shown when order number AND e-mail address match. Max 5 failed tries per conversation and 10 per
  visitor per hour. Kasper never says which of the two was wrong, and never shows addresses or payment details.
- **Read only** in Shopify: Kasper cannot change anything in the store.
- **Only the shop's own website** may use Kasper (`ALLOWED_ORIGINS`); other websites get 403.
- **Contact form**: max 2 per conversation and 5 per visitor per hour; saved requests are deleted after 90 days.
- **The widget** shows everything as plain text, never as code; only `https://` links and `cdn.shopify.com` pictures.
- **Conversations** live in memory only and disappear after 2 hours without activity.

### The chat window

- Starts in the website's language and **switches by itself** when the customer writes in another language
  (NL/EN/DE/FR; others get English). The flag button (▾) lets the customer choose.
- Product cards like on the website: own brand ("Huismerk" with logo) first, green/blue/orange stock label, delivery
  time to the visitor's country, price.
- Typing dots and small animations; **full screen on phones**; less motion for visitors who ask their system for it.

## Settings (`.env`)

| Setting | Meaning |
|---|---|
| `CHAT_MODE` | `claude` = Claude reads the question. `test` = keywords only, free, no AI. |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Claude key and model (`claude-haiku-5-5`). |
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` | Dev Dashboard app "Chatbot" (read only). |
| `SHOP_URL` | Shop address, for product links. |
| `HOUSE_BRAND_TAG`, `HOUSE_BRAND_VENDOR` | Own brand: tag `Huismerk` or vendor `Laboratoriumdiscounter`. |
| `ALLOWED_ORIGINS` | Websites that may use Kasper, comma separated. |
| `TRUST_CLOUDFLARE`, `SHOW_TEST_PAGE` | Set by `docker-compose.yml` on the NAS (tunnel: `true` / `false`). |
| `SPLIT_SHIPMENT_MODE` | `off` / `log` / `tag` – partial shipping choice. |
| `CONTACT_EMAIL_TO`, `EMAIL_ENABLED`, `SMTP_*`, `EMAIL_FROM` | Where contact requests go. |
| `CONTACT_SAVE_DIR`, `CONTACT_RETENTION_DAYS` | Saved contact requests (when e-mail is off) and how long they are kept. |

## Files

| File | What |
|---|---|
| `index.js`, `config.js` | Server and settings |
| `routes/chatRoute.js` | Chat API: start, message, language, partial shipping, contact |
| `routes/rateLimit.js` | Brakes per visitor |
| `safety/guard.js` | Safety filter |
| `safety/texts.js` | Fixed texts per language (refusals, order texts, buttons) |
| `content/faq.js` | Answers to the fixed questions – **fill in `[INVULLEN]`** |
| `chat/interpreter.js` | Claude: message → form |
| `chat/claudeBrain.js`, `chat/testBrain.js` | Kasper's answers |
| `shopify/orders.js` | Order lookup and product search |
| `shopify/delivery.js` | Stock label and delivery time (copy of the theme logic) |
| `email/contactRequest.js` | Contact form: e-mail or file, and clean-up |
| `public/widget.js` | The chat window on the website |
| `Dockerfile`, `docker-compose.yml`, `scripts/makeNasPackage.js` | Running on the NAS |
| `docs/synology-nl.md` | NAS guide (Dutch) |
| `test/` | Tests |
