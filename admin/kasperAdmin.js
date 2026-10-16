import { badRequest } from '../routes/adminRoute.js';
import { ALLOWED_KEYS } from './allowedKeys.js';
import { checkShopifyStore, isValidStoreDomain } from './shopifyCheck.js';

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
    { key: 'ALLOWED_ORIGINS', group: 'Webshop', type: 'text', label: 'Op welke webshop mag de chat verschijnen?', placeholder: 'https://www.laboratoriumdiscounter.nl',
        help: 'Het adres zoals klanten het zien, met https:// ervoor en zonder / aan het eind. Meerdere adressen scheiden met een komma.' },
    { key: 'CLAUDE_MODEL', group: 'Voor de beheerder', advanced: true, type: 'text', label: 'AI-model', fallback: 'claude-haiku-5-5' },
    { key: 'ANTHROPIC_API_KEY', group: 'Voor de beheerder', advanced: true, type: 'secret', label: 'Sleutel van de AI (Claude)', help: 'Wordt nooit getoond. Begint met sk-ant-.' },
    { key: 'SHOPIFY_CLIENT_ID', group: 'Voor de beheerder', advanced: true, type: 'text', label: 'Client ID van de Shopify-app van Kasper' },
    { key: 'SHOPIFY_CLIENT_SECRET', group: 'Voor de beheerder', advanced: true, type: 'secret', label: 'Client secret van de Shopify-app van Kasper', help: 'Wordt nooit getoond. Alleen invullen als je een nieuwe hebt gekregen.' },
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

// stats: { startedAt, conversationsToday, contactToday, day } kept by index.js
export function createKasperAdmin({ env = process.env, stats, useFakeShopify, fetchFn = fetch }) {
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

    return {
        name: 'Kasper',
        enabledKey: 'CHAT_ENABLED',
        allowedKeys: ALLOWED_KEYS,

        async status() {
            const list = checks();
            const worst = list.some((x) => x.level === 'bad') ? 'bad' : list.some((x) => x.level === 'warn') ? 'warn' : 'ok';
            const today = stats.day === new Date().toISOString().slice(0, 10);
            const conversations = today ? stats.conversationsToday : 0;
            const contacts = today ? stats.contactToday : 0;
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
                mode: live ? 'live' : 'test',
                modeText: live
                    ? 'Kasper werkt live: echte gesprekken met AI, en het contactformulier wordt gemaild.'
                    : 'Kasper werkt nu als test. Hij geeft vaste antwoorden of mailt het contactformulier niet door.',
                testLive: [
                    { id: 'kasper', label: 'Kasper (chat)', mode: live ? 'live' : 'test', text: live ? 'Echte gesprekken met AI; het contactformulier wordt gemaild.' : `${(env.CHAT_MODE || 'test') === 'claude' ? 'Antwoordt met AI' : 'Testmodus: vaste antwoorden'}, contactformulier wordt ${env.EMAIL_ENABLED === 'true' ? '' : 'niet '}gemaild.`, settings: true },
                    { id: 'webshop', label: 'Webshop', mode: store === TEST_STORE || useFakeShopify ? 'test' : 'live', text: useFakeShopify ? 'Nep-orders (Shopify niet ingesteld).' : store === TEST_STORE ? `De testwinkel ${store}.` : store },
                ],
                connections: [
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
                if (field.type === 'secret' && key !== 'ANTHROPIC_API_KEY' && text && text.length < 16) problems.push(`${field.label}: te kort.`);
                if (field.type === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) problems.push(`${field.label}: dit is geen geldig e-mailadres.`);
                if (key === 'ALLOWED_ORIGINS' && text && text.split(',').some((o) => !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o.trim()))) problems.push('Chat tonen op: gebruik volledige adressen die met https:// beginnen, zonder / aan het eind.');
                if (key === 'ANTHROPIC_API_KEY' && text && !text.startsWith('sk-ant-')) problems.push('Sleutel van de AI: die begint met sk-ant-.');
            }
            if (values.CHAT_MODE === 'claude' && !values.ANTHROPIC_API_KEY && !env.ANTHROPIC_API_KEY) problems.push('Met AI werkt pas als de sleutel van de AI is ingevuld.');
            return problems;
        },

        actions: {
            async ping() {
                return { ok: true, message: 'Kasper antwoordt.' };
            },

            // Can Kasper read that Shopify store? Read-only, nothing is saved.
            async 'shopify-test'({ domain }) {
                return checkShopifyStore({ storeDomain: String(domain || '').trim().toLowerCase(), clientId: env.SHOPIFY_CLIENT_ID, clientSecret: env.SHOPIFY_CLIENT_SECRET }, fetchFn);
            },
        },
    };
}
