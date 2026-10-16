import { badRequest } from '../routes/adminRoute.js';
import { ALLOWED_KEYS } from './allowedKeys.js';
import { checkShopifyStore, isValidStoreDomain } from './shopifyCheck.js';
import nodemailer from 'nodemailer';

// "0,8" or "0.8" dollars; anything else counts as not filled in
const price = (value) => Number(String(value || '').replace(',', '.')) || 0;

const mailReady = (env) => Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM);

// One short test e-mail to the shop's own contact address, with the saved mail server settings
async function defaultTestMail(env) {
    const port = Number(env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
        host: env.SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, connectionTimeout: 20_000,
    });
    await transport.sendMail({
        from: env.EMAIL_FROM,
        to: env.CONTACT_EMAIL_TO || 'info@laboratoriumdiscounter.nl',
        subject: 'Testmail van Kasper',
        text: 'Dit is een testmail uit het NAS-beheerpaneel. Komt deze aan, dan kan Kasper berichten uit het contactformulier doorsturen.',
    });
}

// What the NAS admin panel shows and may change for Kasper.

// Each setting is shown as a plain question. "choices" become answer cards; "mode" marks the TEST or LIVE answer,
// "risky" asks for an extra confirmation. "shared" settings are set once for all apps (panel tab Algemeen).
const FIELDS = [
    { key: 'CHAT_MODE', group: 'Gesprekken', type: 'select', label: 'Hoe antwoordt Kasper?', fallback: 'test',
        choices: [
            { value: 'test', title: 'Testmodus', text: 'Vaste antwoorden, om uit te proberen. Kost niets.', mode: 'test' },
            { value: 'claude', title: 'Met AI (Claude)', text: 'Echte gesprekken met klanten. Kost per gesprek een klein bedrag. De sleutel van de AI moet ingevuld zijn.', mode: 'live', risky: 'Vanaf nu praat Kasper met echte klanten, met AI. Dat kost per gesprek een klein bedrag.' },
        ] },
    { key: 'EMAIL_ENABLED', group: 'Gesprekken', type: 'bool', label: 'Moeten berichten uit het contactformulier gemaild worden?', fallback: 'false',
        choices: [
            { value: 'false', title: 'Nee, alleen bewaren', text: 'Om uit te proberen. Berichten blijven op de NAS staan en niemand krijgt een mail.', mode: 'test' },
            { value: 'true', title: 'Ja, doorsturen', text: 'Elk bericht gaat per e-mail naar het contactadres van de winkel (zie Algemeen).', mode: 'live' },
        ] },
    { key: 'SPLIT_SHIPMENT_MODE', group: 'Gesprekken', type: 'select', label: 'Mag Kasper aanbieden een order in delen te leveren?', fallback: 'log',
        choices: [
            { value: 'off', title: 'Nee, niet aanbieden', text: 'Kasper noemt deelleveringen niet.' },
            { value: 'log', title: 'Wel aanbieden, alleen noteren', text: 'De keuze van de klant komt alleen in het logboek. Er verandert niets aan de order.' },
            { value: 'tag', title: 'Wel aanbieden, op de order zetten', text: 'De keuze van de klant komt als label op de order in Shopify.' },
        ] },
    { key: 'PUBLISH_WIDGET_URL', group: 'Webshop', type: 'bool', label: 'Moet Kasper zijn adres zelf in de webshop zetten?', fallback: 'false',
        help: 'Werkt alleen als het thema het adres uit de webshop leest (één keer aanpassen, zie de handleiding) en de Shopify-app van Kasper dit mag schrijven.',
        choices: [
            { value: 'true', title: 'Ja, automatisch', text: 'Krijgt de tunnel een nieuw adres, dan zet Kasper dat binnen een paar minuten zelf in de webshop.' },
            { value: 'false', title: 'Nee, met de hand', text: 'Na een herstart moet iemand de script-tag in het thema zelf aanpassen.' },
        ] },
    { key: 'ALLOWED_ORIGINS', group: 'Webshop', type: 'text', label: 'Op welke webshop mag de chat verschijnen?', placeholder: 'https://www.laboratoriumdiscounter.nl',
        help: 'Het adres zoals klanten het zien, met https:// ervoor en zonder / aan het eind. Meerdere adressen scheiden met een komma.' },
    { key: 'CLAUDE_MODEL', group: 'Voor de beheerder', advanced: true, type: 'text', label: 'AI-model', fallback: 'claude-haiku-5-5' },
    { key: 'CLAUDE_PRICE_INPUT', group: 'Voor de beheerder', advanced: true, live: true, type: 'decimal', label: 'Prijs voor lezen, in dollar per miljoen tokens', placeholder: 'bijvoorbeeld 1', help: 'Staat op de prijzenpagina van Anthropic bij het AI-model hierboven ("input"). Alleen voor de kostenschatting bij Cijfers.' },
    { key: 'CLAUDE_PRICE_OUTPUT', group: 'Voor de beheerder', advanced: true, live: true, type: 'decimal', label: 'Prijs voor schrijven, in dollar per miljoen tokens', placeholder: 'bijvoorbeeld 5', help: 'Staat op de prijzenpagina van Anthropic bij het AI-model hierboven ("output").' },
    { key: 'ANTHROPIC_API_KEY', group: 'Voor de beheerder', advanced: true, type: 'secret', label: 'Sleutel van de AI (Claude)', help: 'Wordt nooit getoond. Begint met sk-ant-.' },
    { key: 'SHOPIFY_CLIENT_ID', group: 'Voor de beheerder', advanced: true, type: 'text', label: 'Client ID van de Shopify-app van Kasper' },
    { key: 'SHOPIFY_CLIENT_SECRET', group: 'Voor de beheerder', advanced: true, type: 'secret', label: 'Client secret van de Shopify-app van Kasper', help: 'Wordt nooit getoond. Alleen invullen als je een nieuwe hebt gekregen.' },
    { key: 'SMTP_HOST', group: 'Uitgaande mail (contactformulier)', advanced: true, type: 'text', label: 'Uitgaande mailserver (SMTP)', fallback: 'smtp.hostnet.nl', help: 'Kasper verstuurt alleen mail, hij leest geen mail. Vul dus de UITGAANDE server in (SMTP), niet de inkomende (IMAP of POP). Bij Hostnet: smtp.hostnet.nl.' },
    { key: 'SMTP_PORT', group: 'Uitgaande mail (contactformulier)', advanced: true, type: 'number', label: 'Poort van de uitgaande server', fallback: '587', help: '587 (gebruikelijk) of 465. De verbinding is altijd versleuteld. Niet 993 of 995: dat zijn poorten voor inkomende mail.' },
    { key: 'SMTP_USER', group: 'Uitgaande mail (contactformulier)', advanced: true, type: 'text', label: 'Gebruikersnaam van de mailbox', help: 'Meestal het volledige e-mailadres van de mailbox waarmee Kasper verstuurt.' },
    { key: 'SMTP_PASSWORD', group: 'Uitgaande mail (contactformulier)', advanced: true, type: 'secret', label: 'Wachtwoord van de mailbox', help: 'Wordt nooit getoond. Leeg laten = niet veranderen.' },
    { key: 'EMAIL_FROM', group: 'Uitgaande mail (contactformulier)', advanced: true, type: 'text', label: 'Afzender', placeholder: 'Kasper <kasper@laboratoriumdiscounter.nl>', help: 'Hoe de mail binnenkomt, bijvoorbeeld Kasper <kasper@laboratoriumdiscounter.nl>. Het adres moet bij de mailbox horen.' },
    { key: 'SHOPIFY_STORE_DOMAIN', shared: 'shopDomain', type: 'text', label: 'Webshop (Shopify)' },
    { key: 'CONTACT_EMAIL_TO', shared: 'contactEmail', type: 'email', label: 'Contactadres van de winkel', fallback: 'info@laboratoriumdiscounter.nl' },
];

// Which shared panel setting (tab Algemeen) is which setting in this app
const SHARED_KEYS = { shopDomain: 'SHOPIFY_STORE_DOMAIN', contactEmail: 'CONTACT_EMAIL_TO' };
const TEST_STORE = 'hevjuq-bg.myshopify.com';

export function translateLine(text) {
    const rules = [
        [/^Chatbot running on port/, () => ({ text: 'Kasper gestart.', level: 'ok' })],
        [/^Mode: (test|claude)/, (m) => ({ text: m[1] === 'claude' ? 'Kasper antwoordt met AI (Claude).' : 'Kasper staat in testmodus (vaste antwoorden).', level: 'ok' })],
        [/^Chat allowed on: (.*)/, (m) => ({ text: `Chat toegestaan op: ${m[1]}`, level: 'ok' })],
        [/Order lookups blocked/, () => ({ text: 'Iemand probeerde te vaak een order op te zoeken en is even geblokkeerd.', level: 'warn' })],
        [/Contact requests blocked/, () => ({ text: 'Iemand stuurde te veel contactberichten en is even geblokkeerd.', level: 'warn' })],
        [/^Settings changed in the admin panel.*no restart needed/, () => ({ text: 'Instellingen gewijzigd in het paneel (meteen actief, zonder herstart).', level: 'ok' })],
        [/^Settings changed in the admin panel/, () => ({ text: 'Instellingen gewijzigd in het paneel. Kasper start opnieuw.', level: 'ok' })],
        [/switched (on|off) in the admin panel/, (m) => ({ text: `Kasper ${m[1] === 'on' ? 'aangezet' : 'uitgezet'} in het paneel.`, level: 'ok' })],
        [/^Chat switched off/, () => ({ text: 'Kasper staat uit: de chatknop is niet zichtbaar in de webshop.', level: 'warn' })],
        [/restarted from the admin panel/, () => ({ text: 'Kasper opnieuw gestart via het paneel.', level: 'ok' })],
        [/^Contact request (sent|saved)/, (m) => ({ text: m[1] === 'sent' ? 'Contactbericht doorgestuurd per e-mail.' : 'Contactbericht bewaard (e-mail staat uit).', level: 'ok' })],
    ];
    for (const [pattern, make] of rules) {
        const match = text.match(pattern);
        if (match) return make(match);
    }
    return null;
}

// The numbers for the panel: a table (today, this week, this month) and conversations per day.
// Only counts; what customers wrote is never kept.
// prices: dollars per million tokens (CLAUDE_PRICE_INPUT / CLAUDE_PRICE_OUTPUT); empty = no cost shown.
// Claude's answers only hold token counts, no price, so the cost is an estimate from these prices.
export function figures(numbers, prices = {}) {
    const known = prices.input > 0 && prices.output > 0;
    const withHelped = (values) => {
        const costIn = known ? (values.inputTokens * prices.input) / 1e6 : null;
        const costOut = known ? (values.outputTokens * prices.output) / 1e6 : null;
        return { ...values, helped: Math.max(0, values.conversations - values.contactSent), tokens: values.inputTokens + values.outputTokens, costIn, costOut, cost: known ? costIn + costOut : null };
    };
    return {
        title: 'Cijfers',
        note: `Alleen aantallen. Wat klanten schrijven wordt niet bewaard. Tokens = wat de AI (Claude) heeft gelezen en geschreven; in testmodus zijn dat er 0. ${known
            ? `De kosten zijn een schatting met $ ${prices.input} (lezen) en $ ${prices.output} (schrijven) per miljoen tokens; de echte rekening staat in de Anthropic Console.`
            : 'Vul onder Instellingen → "Voor de beheerder" de prijs per miljoen tokens in om de kosten te zien.'}`,
        periods: [
            { label: 'Vandaag', values: withHelped(numbers.today) },
            { label: 'Deze week', values: withHelped(numbers.week) },
            { label: 'Deze maand', values: withHelped(numbers.month) },
        ],
        rows: [
            { key: 'conversations', label: 'Gesprekken' },
            { key: 'helped', label: 'Zonder doorsturen afgehandeld', hint: 'Gesprekken zonder bericht via het contactformulier.' },
            { key: 'orderLookups', label: 'Orders opgezocht' },
            { key: 'productQuestions', label: 'Vragen over producten' },
            { key: 'contactOffered', label: 'Contactformulier aangeboden' },
            { key: 'contactSent', label: 'Berichten via het contactformulier' },
            { key: 'inputTokens', label: 'Tokens gelezen door de AI', group: 'tokens' },
            { key: 'outputTokens', label: 'Tokens geschreven door de AI', group: 'tokens' },
            { key: 'tokens', label: 'Tokens totaal', group: 'tokens', bold: true },
            { key: 'costIn', label: 'Kosten lezen', group: 'cost', format: 'usd' },
            { key: 'costOut', label: 'Kosten schrijven', group: 'cost', format: 'usd' },
            { key: 'cost', label: 'Kosten totaal (schatting)', group: 'cost', format: 'usd', bold: true },
        ],
        chart: { label: 'Gesprekken per dag, laatste 30 dagen', days: numbers.last30.map((d) => ({ day: d.day, value: d.conversations })) },
    };
}

// stats: the day counters of admin/stats.js; contact: the contact settings (for the test e-mail)
export function createKasperAdmin({ env = process.env, stats, useFakeShopify, contact, widgetAddress = null, sendTestMail = defaultTestMail, fetchFn = fetch }) {
    const enabled = () => env.CHAT_ENABLED !== 'false';

    function checks() {
        const list = [];
        list.push(useFakeShopify
            ? { id: 'shopify', level: 'warn', label: 'Webshop (Shopify) — testgegevens', detail: 'Kasper gebruikt nep-orders. Vul de Shopify-gegevens in om echte orders op te zoeken.' }
            : { id: 'shopify', level: 'ok', label: 'Webshop (Shopify) — verbonden', detail: `Orders en voorraad van ${env.SHOPIFY_STORE_DOMAIN}.` });
        const mode = env.CHAT_MODE || 'test';
        list.push(mode === 'claude'
            ? { id: 'ai', level: env.ANTHROPIC_API_KEY ? 'ok' : 'bad', label: env.ANTHROPIC_API_KEY ? 'AI (Claude) — ingesteld' : 'AI (Claude) — sleutel ontbreekt', detail: env.ANTHROPIC_API_KEY ? `Model ${env.CLAUDE_MODEL || 'claude-haiku-5-5'}.` : 'Vul de sleutel in bij Instellingen → Geavanceerd.' }
            : { id: 'ai', level: 'warn', label: 'AI — testmodus', detail: 'Kasper geeft vaste antwoorden. Zet "Hoe Kasper antwoordt" op "Met AI" voor echte gesprekken.' });
        list.push(env.EMAIL_ENABLED === 'true'
            ? { id: 'contact', level: 'ok', label: 'Contactformulier — wordt gemaild', detail: `Naar ${env.CONTACT_EMAIL_TO || 'info@laboratoriumdiscounter.nl'}.` }
            : { id: 'contact', level: 'warn', label: 'Contactformulier — niet gemaild (test)', detail: 'Berichten worden alleen bewaard.' });
        const origins = String(env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
        list.push(origins.length
            ? { id: 'shop', level: 'ok', label: 'Chat in de webshop — toegestaan', detail: origins.join(', ') }
            : { id: 'shop', level: 'bad', label: 'Chat in de webshop — geen webshop ingesteld', detail: 'Vul bij Instellingen in op welke webshop de chat mag verschijnen.' });
        return list;
    }

    // The chat address in the shop (shopify/widgetAddress.js)
    function widgetConnection() {
        const s = widgetAddress?.state;
        if (env.PUBLISH_WIDGET_URL !== 'true') {
            return { id: 'widget', title: 'Chatadres in de webshop', level: 'warn', state: 'met de hand', text: 'Na een herstart van Kasper moet de script-tag in het thema met de hand worden aangepast. Zet hierboven "Moet Kasper zijn adres zelf in de webshop zetten?" op Ja om dat te automatiseren.' };
        }
        if (s?.error === 'no-access') return { id: 'widget', title: 'Chatadres in de webshop', level: 'bad', state: 'geen toegang', text: 'Shopify staat Kasper niet toe het adres in de webshop te zetten. De Shopify-app van Kasper heeft daarvoor een extra recht nodig (zie de handleiding).' };
        if (s?.error) return { id: 'widget', title: 'Chatadres in de webshop', level: 'warn', state: 'niet gelukt', text: `Het adres kon niet worden bijgewerkt: ${s.error}. Kasper probeert het elke 5 minuten opnieuw.` };
        if (s?.published) return { id: 'widget', title: 'Chatadres in de webshop', level: 'ok', state: 'automatisch', text: `De webshop gebruikt ${s.published}. Verandert de tunnel, dan past Kasper dit zelf aan.` };
        return { id: 'widget', title: 'Chatadres in de webshop', level: 'warn', state: 'bezig', text: 'Kasper zet zijn adres zo in de webshop (binnen een paar minuten na het starten).' };
    }

    return {
        name: 'Kasper',
        enabledKey: 'CHAT_ENABLED',
        allowedKeys: ALLOWED_KEYS,
        // Read at every use, so saving them needs no restart
        liveKeys: ['CLAUDE_PRICE_INPUT', 'CLAUDE_PRICE_OUTPUT'],

        async status() {
            const list = checks();
            const worst = list.some((x) => x.level === 'bad') ? 'bad' : list.some((x) => x.level === 'warn') ? 'warn' : 'ok';
            const numbers = stats.summary();
            const conversations = numbers.today.conversations;
            const contacts = numbers.today.contactSent;
            const live = (env.CHAT_MODE || 'test') === 'claude' && env.EMAIL_ENABLED === 'true';
            const store = env.SHOPIFY_STORE_DOMAIN || '';
            return {
                app: 'kasper',
                name: 'Kasper (chat)',
                enabled: enabled(),
                level: enabled() ? worst : 'warn',
                summary: enabled() ? 'Kasper beantwoordt chats.' : 'Kasper staat uit. De chatknop is niet zichtbaar in de webshop.',
                detail: `Vandaag ${conversations} ${conversations === 1 ? 'gesprek' : 'gesprekken'}, waarvan ${contacts} doorgestuurd via het contactformulier.`,
                onoff: { label: 'Chat in de webshop', on: 'Aan · de chatknop staat rechtsonder in de webshop', off: 'Uit · de chatknop is niet zichtbaar', confirmOff: 'De chatknop verdwijnt uit de webshop. Klanten kunnen dan alleen mailen of bellen.' },
                checks: list,
                todo: list.filter((c) => c.level === 'bad').map((c) => ({ id: c.id, level: 'bad', title: c.label, why: '', how: c.detail })),
                figures: figures(numbers, { input: price(env.CLAUDE_PRICE_INPUT), output: price(env.CLAUDE_PRICE_OUTPUT) }),
                mode: live ? 'live' : 'test',
                modeText: live
                    ? 'Kasper werkt live: echte gesprekken met AI, en het contactformulier wordt gemaild.'
                    : 'Kasper werkt nu als test. Hij geeft vaste antwoorden of mailt het contactformulier niet door.',
                testLive: [
                    { id: 'kasper', label: 'Kasper (chat)', mode: live ? 'live' : 'test', text: live ? 'Echte gesprekken met AI; het contactformulier wordt gemaild.' : `${(env.CHAT_MODE || 'test') === 'claude' ? 'Antwoordt met AI' : 'Testmodus: vaste antwoorden'}, contactformulier wordt ${env.EMAIL_ENABLED === 'true' ? '' : 'niet '}gemaild.`, settings: true },
                    { id: 'webshop', label: 'Webshop', mode: store === TEST_STORE || useFakeShopify ? 'test' : 'live', text: useFakeShopify ? 'Nep-orders (Shopify niet ingesteld).' : store === TEST_STORE ? `De testwinkel ${store}.` : store },
                ],
                connections: [
                    widgetConnection(),
                    {
                        id: 'mail',
                        title: 'Uitgaande mail (contactformulier)',
                        level: mailReady(env) ? 'ok' : 'warn',
                        state: mailReady(env) ? 'ingesteld' : 'niet ingesteld',
                        text: mailReady(env) ? `Berichten gaan via ${env.SMTP_HOST} naar ${env.CONTACT_EMAIL_TO || 'info@laboratoriumdiscounter.nl'}.` : 'Vul de uitgaande mailserver (SMTP) in onder "Uitgaande mail (contactformulier)" hieronder. Daarna kan "doorsturen" aan.',
                        note: 'Pas de mailserver eerst aan en sla op; test daarna.',
                        action: mailReady(env) ? { id: 'test-mail', label: 'Testmail sturen', confirm: `Er gaat echt een e-mail naar ${env.CONTACT_EMAIL_TO || 'info@laboratoriumdiscounter.nl'}.` } : null,
                    },
                    { id: 'webshop', title: 'Webshop (Shopify)', mode: store === TEST_STORE || useFakeShopify ? 'test' : 'live', level: useFakeShopify ? 'warn' : 'ok', state: useFakeShopify ? 'nep-orders' : 'verbonden', text: `Winkel ${store || '(niet ingesteld)'}. De webshop is voor alle apps dezelfde en stel je in bij Algemeen.`, general: true },
                ],
                sharedKeys: SHARED_KEYS,
                shared: { shopDomain: store, contactEmail: env.CONTACT_EMAIL_TO || 'info@laboratoriumdiscounter.nl' },
                container: 'casper',
            };
        },

        fields() {
            return FIELDS.map((field) => {
                const raw = env[field.key];
                const value = raw === undefined || raw === '' ? field.fallback ?? '' : raw;
                return field.type === 'secret' ? { ...field, value: null, isSet: Boolean(raw) } : { ...field, value };
            });
        },

        validate(values) {
            const problems = [];
            for (const [key, value] of Object.entries(values)) {
                const field = FIELDS.find((f) => f.key === key) || (key === 'CHAT_ENABLED' ? { type: 'bool', label: key } : null);
                if (!field) {
                    problems.push(`${key} kan hier niet worden aangepast.`);
                    continue;
                }
                const text = String(value);
                if (field.type === 'bool' && !['true', 'false'].includes(text)) problems.push(`${field.label}: kies aan of uit.`);
                if (field.type === 'select' && !field.choices.some((o) => o.value === text)) problems.push(`${field.label}: kies een van de opties.`);
                if (key === 'SHOPIFY_STORE_DOMAIN' && !isValidStoreDomain(text)) problems.push('Webshop: het adres moet eindigen op .myshopify.com.');
                if (key === 'SHOPIFY_CLIENT_ID' && text && !/^[a-f0-9]{32}$/i.test(text)) problems.push('Client ID: dat lijkt geen Shopify client ID (32 tekens).');
                if (field.type === 'decimal' && text && !/^\d{1,5}([.,]\d{1,4})?$/.test(text)) problems.push(`${field.label}: vul een bedrag in, bijvoorbeeld 1 of 0,8.`);
                if (key === 'SHOPIFY_CLIENT_SECRET' && text && text.length < 16) problems.push(`${field.label}: te kort.`);
                if (key === 'SMTP_HOST' && text && !/^[a-z0-9.-]{3,253}$/i.test(text)) problems.push('Mailserver: alleen de naam, bijvoorbeeld smtp.hostnet.nl.');
                if (key === 'SMTP_PORT' && !(Number.isInteger(Number(text)) && Number(text) >= 1 && Number(text) <= 65535)) problems.push('Poort: vul een getal in, meestal 587.');
                if (key === 'SMTP_PORT' && ['110', '143', '993', '995'].includes(text)) problems.push('Poort: dit is een poort voor inkomende mail. Kasper verstuurt alleen mail; gebruik 587 of 465.');
                if (key === 'SMTP_HOST' && /^(imap|pop3?)\./i.test(text)) problems.push('Mailserver: dit is een server voor inkomende mail. Vul de uitgaande server in, bijvoorbeeld smtp.hostnet.nl.');
                if (key === 'EMAIL_FROM' && text && !/^([^<>\r\n]{0,60}<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(text)) problems.push('Afzender: bijvoorbeeld Kasper <kasper@laboratoriumdiscounter.nl>.');
                if (field.type === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) problems.push(`${field.label}: dit is geen geldig e-mailadres.`);
                if (key === 'ALLOWED_ORIGINS' && text && text.split(',').some((o) => !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o.trim()))) problems.push('Chat tonen op: gebruik volledige adressen die met https:// beginnen, zonder / aan het eind.');
                if (key === 'ANTHROPIC_API_KEY' && text && !text.startsWith('sk-ant-')) problems.push('Sleutel van de AI: die begint met sk-ant-.');
            }
            if (values.CHAT_MODE === 'claude' && !values.ANTHROPIC_API_KEY && !env.ANTHROPIC_API_KEY) problems.push('Met AI werkt pas als de sleutel van de AI is ingevuld.');
            // Kasper refuses to start when e-mail is on without a complete mail server: never save that
            const after = { ...env, ...values };
            if (after.EMAIL_ENABLED === 'true' && !mailReady(after)) problems.push('Doorsturen per e-mail kan pas als de mailserver helemaal is ingevuld (mailserver, gebruikersnaam, wachtwoord en afzender).');
            return problems;
        },

        actions: {
            async ping() {
                return { ok: true, message: 'Kasper antwoordt.' };
            },

            // Sends one test e-mail to the shop's contact address (only from the panel, after a confirmation)
            async 'test-mail'() {
                if (!mailReady(env)) throw badRequest('Vul eerst de mailserver in en sla op.');
                try {
                    await sendTestMail(env);
                } catch (error) {
                    console.log(`Test e-mail failed: ${error.message}`);
                    throw badRequest('De testmail kon niet verstuurd worden. Kloppen mailserver, poort, gebruikersnaam en wachtwoord?');
                }
                console.log('Test e-mail sent from the admin panel');
                return { ok: true, message: `Testmail verstuurd naar ${env.CONTACT_EMAIL_TO || 'info@laboratoriumdiscounter.nl'}. Kijk of hij aankomt.` };
            },

            // Can Kasper read that Shopify store? Read-only, nothing is saved.
            async 'shopify-test'({ domain }) {
                return checkShopifyStore({ storeDomain: String(domain || '').trim().toLowerCase(), clientId: env.SHOPIFY_CLIENT_ID, clientSecret: env.SHOPIFY_CLIENT_SECRET }, fetchFn);
            },
        },
    };
}
