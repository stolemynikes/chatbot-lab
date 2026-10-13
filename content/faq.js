// The fixed questions the bot can answer. In test mode these texts are shown word for word;
// later Claude uses the same texts as its only source of information about shop policy.
//
// Fill in every [INVULLEN] with your own policy. Languages without their own text use English.
// `keywords` are matched in test mode (lowercase, without accents). A message about an order
// ("where is my order") is handled separately, see chat/testBrain.js.

export const faq = [
    {
        id: 'shipping',
        keywords: ['verzend', 'verzenden', 'verzending', 'levertijd', 'bezorg', 'shipping', 'delivery', 'deliver', 'versand', 'lieferzeit', 'livraison', 'expedition', 'postnl', 'gls', 'dhl', 'buitenland', 'abroad'],
        answer: {
            nl: 'Bestellingen die op werkdagen vóór [INVULLEN: tijd] zijn betaald, versturen we dezelfde dag. In Nederland is de levertijd meestal [INVULLEN: x] werkdagen, in de rest van de EU [INVULLEN: x] werkdagen. De verzendkosten zie je in de winkelwagen voordat je betaalt. Sommige gevaarlijke stoffen mogen alleen met speciale verzending of niet naar alle landen.',
            en: 'Orders paid on working days before [INVULLEN: time] are shipped the same day. Delivery in the Netherlands usually takes [INVULLEN: x] working days, in the rest of the EU [INVULLEN: x] working days. You can see the shipping costs in the cart before you pay. Some hazardous goods can only be sent with special transport or not to every country.',
        },
    },
    {
        id: 'returns',
        keywords: ['retour', 'terugsturen', 'herroep', 'ruilen', 'return', 'refund', 'geld terug', 'rucksend', 'rückgabe', 'ruckgabe', 'widerruf', 'retourner', 'remboursement', 'kapot', 'beschadigd', 'damaged', 'broken', 'lekt', 'leaking'],
        answer: {
            nl: '[INVULLEN: retourbeleid, bijv. binnen hoeveel dagen, welke producten uitgesloten zijn (geopende chemicaliën?), hoe je een retour aanmeldt]. Is je pakket beschadigd of lekt het? Open het niet verder en stuur ons een bericht met een foto.',
            en: "[INVULLEN: return policy, e.g. within how many days, which products are excluded (opened chemicals?), how to register a return]. Is your parcel damaged or leaking? Don't open it further and send us a message with a photo.",
        },
        offerContact: true,
    },
    {
        id: 'invoice',
        keywords: ['factuur', 'facturen', 'invoice', 'rechnung', 'facture', 'btw', 'vat', 'bon', 'receipt'],
        answer: {
            nl: 'Je factuur ontvang je [INVULLEN: per e-mail / te downloaden in je account onder Bestellingen]. Heb je een factuur op een ander adres of met btw-nummer nodig? Stuur ons een bericht met je ordernummer.',
            en: 'You receive your invoice [INVULLEN: by e-mail / to download in your account under Orders]. Do you need an invoice with another address or a VAT number? Send us a message with your order number.',
        },
        offerContact: true,
    },
    {
        id: 'payment',
        keywords: ['betalen', 'betaling', 'betaalmethode', 'ideal', 'creditcard', 'paypal', 'op rekening', 'achteraf', 'payment', 'pay', 'zahlung', 'bezahlen', 'paiement', 'payer'],
        answer: {
            nl: 'Je kunt betalen met [INVULLEN: iDEAL, creditcard, Bancontact, ...]. Zakelijke klanten kunnen [INVULLEN: wel/niet] op rekening bestellen.',
            en: 'You can pay with [INVULLEN: iDEAL, credit card, Bancontact, ...]. Business customers can [INVULLEN: / cannot] order on account.',
        },
    },
    {
        id: 'account',
        keywords: ['account', 'inloggen', 'login', 'log in', 'wachtwoord', 'password', 'registreren', 'anmelden', 'konto', 'compte', 'connexion'],
        answer: {
            nl: 'Inloggen doe je via het account-icoon rechtsboven in de webshop. Je ontvangt dan een code per e-mail, een wachtwoord is niet nodig. Daar zie je ook je bestellingen.',
            en: 'You can log in with the account icon at the top right of the shop. You will receive a code by e-mail, no password needed. There you can also see your orders.',
        },
    },
    {
        id: 'sds',
        keywords: ['sds', 'msds', 'veiligheidsinformatieblad', 'veiligheidsblad', 'safety data sheet', 'datasheet', 'sicherheitsdatenblatt', 'fds', 'fiche de donnees', 'coa', 'certificaat', 'certificate', 'analysecertificaat'],
        answer: {
            nl: 'Het veiligheidsinformatieblad (SDS) vind je [INVULLEN: op de productpagina onder "Downloads"]. Een analysecertificaat (CoA) van een bepaalde batch kun je bij ons opvragen: stuur ons een bericht met de productnaam en het batchnummer.',
            en: 'You can find the safety data sheet (SDS) [INVULLEN: on the product page under "Downloads"]. You can request a certificate of analysis (CoA) for a specific batch: send us a message with the product name and batch number.',
        },
        offerContact: true,
    },
    {
        id: 'business',
        keywords: ['zakelijk', 'bedrijf', 'b2b', 'offerte', 'quote', 'grote hoeveelheid', 'bulk', 'business', 'company', 'firma', 'angebot', 'devis', 'entreprise', 'particulier', 'consument', 'private'],
        answer: {
            nl: '[INVULLEN: wie mag bij jullie bestellen (particulieren / alleen bedrijven voor bepaalde stoffen?), hoe een offerte aanvragen]. Voor een offerte of grote hoeveelheden: stuur ons een bericht.',
            en: '[INVULLEN: who can order (private customers / business only for certain substances?), how to request a quote]. For a quote or large quantities: send us a message.',
        },
        offerContact: true,
    },
    {
        id: 'human',
        keywords: ['medewerker', 'mens', 'persoon', 'iemand spreken', 'bellen', 'telefoon', 'contact', 'human', 'person', 'agent', 'call', 'phone', 'mitarbeiter', 'mensch', 'anrufen', 'conseiller', 'humain', 'telephone'],
        answer: {
            nl: 'Je kunt ons een bericht sturen via de knop hieronder, dan reageren we per e-mail. [INVULLEN: telefoonnummer en openingstijden, als je die wilt noemen]',
            en: 'You can send us a message with the button below, and we will reply by e-mail. [INVULLEN: phone number and opening hours, if you want to share them]',
        },
        offerContact: true,
    },
];

export function faqAnswer(entry, language) {
    return entry.answer[language] || entry.answer.en;
}
