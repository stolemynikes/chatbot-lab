// The fixed questions Kasper can answer. These texts are shown word for word (Claude never writes them).
//
// Source: the shop's own texts and settings (theme locales "lab.*", the contact page section, the shop metafields
// custom.delivery_rules and custom.volume_tiers, the small-order surcharge), read on 2026-10-13.
// When the shop changes something (phone hours, payment on account, surcharge...), change it here too.
//
// Returns: the return policy on laboratoriumdiscounter.nl. Invoices: the invoice app's customer account pages.
// Languages without their own text use English.
// `offerContact` shows the "ask our team" button; `openContactForm` opens the form right away.
// `keywords` are matched in test mode (lowercase, without accents). A message about an order
// ("where is my order") is handled separately, see chat/testBrain.js.

export const faq = [
    {
        id: 'shipping',
        keywords: ['verzend', 'verzenden', 'verzending', 'levertijd', 'bezorg', 'shipping', 'delivery', 'deliver', 'versand', 'lieferzeit', 'livraison', 'expedition', 'postnl', 'gls', 'dhl', 'buitenland', 'abroad', 'toeslag', 'surcharge'],
        answer: {
            nl: 'Op elke productpagina zie je de levertijd naar jouw land; vraag het mij ook gerust voor een product. Op voorraad is dat naar Nederland en België meestal 1–2 werkdagen, naar Duitsland, Frankrijk, Oostenrijk, Denemarken, Polen en Luxemburg 2–3 werkdagen en naar de meeste andere EU-landen 3–4 werkdagen (Finland, Ierland, Bulgarije en Griekenland iets langer). Producten die wij bij een leverancier bestellen en gevaarlijke stoffen die onder ADR worden verzonden, hebben een paar dagen langer nodig.\n\nDe verzendkosten zie je in de winkelwagen voordat je betaalt. Voor sommige gevaarlijke stoffen gelden ADR-verzendkosten; die vervangen dan de normale verzendkosten voor de hele bestelling. Voor bestellingen onder € 30 rekenen wij een toeslag van € 5.',
            en: 'Every product page shows the delivery time to your country, and you can also ask me about a product. For items in stock it is usually 1–2 working days to the Netherlands and Belgium, 2–3 working days to Germany, France, Austria, Denmark, Poland and Luxembourg, and 3–4 working days to most other EU countries (a little longer to Finland, Ireland, Bulgaria and Greece). Products we order from a supplier and hazardous goods shipped under ADR take a few days longer.\n\nYou can see the shipping costs in the cart before you pay. Some hazardous substances have ADR shipping costs; these then replace the normal shipping costs for the whole order. Orders under € 30 carry a surcharge of € 5.',
        },
    },
    {
        id: 'returns',
        keywords: ['retour', 'terugsturen', 'herroep', 'ruilen', 'return', 'refund', 'geld terug', 'rucksend', 'ruckgabe', 'widerruf', 'retourner', 'remboursement', 'kapot', 'beschadigd', 'damaged', 'broken', 'lekt', 'leaking'],
        // Source: the return policy on laboratoriumdiscounter.nl (2026-10-15)
        answer: {
            nl: 'Chemicaliën kunnen helaas niet retour. Particulieren mogen chemische stoffen niet per post versturen, ook geen LQ-stoffen. Bovendien kunnen we de zuiverheid niet meer garanderen zodra een pakket is ontvangen, dus kunnen we het niet terugnemen en opnieuw verkopen. Op onze site staat bij elke stof de ADR-code; daarmee kun je opzoeken of een stof onder de ADR-regels valt.\n\nArtikelen die geen chemicaliën zijn, kunnen in sommige gevallen wel retour, maar alleen in overleg met ons. Zendingen die zonder overleg worden teruggestuurd, nemen we meestal niet aan. De kosten van het terugsturen zijn voor eigen rekening.\n\nIs je pakket beschadigd of lekt het? Open het niet verder en stuur ons een bericht met een foto. En snap je iets niet? Neem gerust contact met ons op, we leggen het graag uit.',
            en: "Unfortunately, chemicals cannot be returned. Private individuals are not allowed to send chemical substances by post, and this also applies to LQ substances. Also, the purity can no longer be guaranteed once a package has been received, so we cannot take it back and resell it. Our site shows the ADR code of each substance; with it you can look up whether a substance falls under the ADR rules.\n\nNon-chemical products can be returned in certain cases, but only after consulting us first. Shipments returned to us without contacting us first are generally not accepted. The costs of returning are for your own account.\n\nIs your parcel damaged or leaking? Don't open it further and send us a message with a photo. And if something is not clear, just contact us, we are happy to explain.",
        },
        offerContact: true,
    },
    {
        id: 'cancel',
        keywords: ['annuleer', 'annuleren', 'annulering', 'cancel', 'cancellation', 'stornieren', 'stornierung', 'annuler', 'annulation', 'niet meer nodig', 'afbestellen'],
        // Kasper never cancels anything himself: the form opens right away, a person handles it
        answer: {
            nl: 'Een bestelling annuleren kan ik niet zelf doen. Stuur hieronder een bericht aan onze klantenservice, met je ordernummer als je dat hebt. Een medewerker bekijkt zo snel mogelijk of annuleren nog kan en laat het je per e-mail weten.',
            en: 'I cannot cancel an order myself. Please send a message to our customer service below, with your order number if you have it. Someone from our team will check as soon as possible whether the order can still be cancelled and let you know by e-mail.',
        },
        offerContact: true,
        openContactForm: true,
    },
    {
        id: 'invoice',
        keywords: ['factuur', 'facturen', 'invoice', 'rechnung', 'facture', 'btw', 'vat', 'bon', 'receipt', 'creditnota', 'credit note', 'creditfactuur'],
        answer: {
            nl: 'Je factuur kun je downloaden in je account: klik op het account-icoon en kies "Facturen". Daar staan de facturen en creditnota\'s van al je bestellingen. Je vindt de factuur ook in de bestelling zelf ("Factuur downloaden (PDF)"), samen met een eventuele creditnota.\n\nMoet er iets op de factuur veranderen, zoals het adres of het btw-nummer? Stuur ons een bericht met je ordernummer, dan regelen we het. Zakelijke klanten kunnen in de winkelwagen tot twee extra e-mailadressen opgeven waar de factuur ook naartoe gaat.',
            en: 'You can download your invoice in your account: click the account icon and choose "Invoices". There you will find the invoices and credit notes of all your orders. The invoice is also in the order itself ("Download invoice (PDF)"), together with any credit note.\n\nShould something on the invoice change, such as the address or the VAT number? Send us a message with your order number and we will take care of it. Business customers can enter up to two extra e-mail addresses in the cart that the invoice is also sent to.',
        },
        offerContact: true,
    },
    {
        id: 'payment',
        keywords: ['betalen', 'betaling', 'betaalmethode', 'ideal', 'creditcard', 'paypal', 'op rekening', 'achteraf', 'payment', 'pay', 'zahlung', 'bezahlen', 'paiement', 'payer'],
        answer: {
            nl: 'Bij het afrekenen zie je welke betaalmethoden er voor jouw land beschikbaar zijn.\n\nZakelijke klanten kunnen op rekening bestellen: je betaalt dan binnen 30 dagen na de factuurdatum. Je eerste bestelling betaal je altijd via de website; daarna kun je in je zakelijke account betalen op rekening aanvragen. Wij beoordelen elke aanvraag persoonlijk en nemen binnen twee werkdagen contact met je op.',
            en: 'At checkout you can see which payment methods are available for your country.\n\nBusiness customers can order on account: you pay within 30 days of the invoice date. Your first order is always paid through the website; after that you can apply for payment on account in your business account. We review every application personally and get back to you within two working days.',
        },
    },
    {
        id: 'account',
        keywords: ['account', 'inloggen', 'login', 'log in', 'wachtwoord', 'password', 'registreren', 'anmelden', 'konto', 'compte', 'connexion'],
        answer: {
            nl: 'Inloggen of een account aanmaken doe je via het account-icoon in de webshop. Je hebt geen wachtwoord nodig: je ontvangt een inlogcode per e-mail. In je account zie je ook je bestellingen.',
            en: 'You can log in or create an account with the account icon in the shop. No password needed: you will receive a login code by e-mail. Your account also shows your orders.',
        },
    },
    {
        id: 'sds',
        keywords: ['sds', 'msds', 'veiligheidsinformatieblad', 'veiligheidsblad', 'safety data sheet', 'datasheet', 'sicherheitsdatenblatt', 'fds', 'fiche de donnees', 'coa', 'certificaat', 'certificate', 'analysecertificaat'],
        answer: {
            nl: 'Het veiligheidsinformatieblad (SDS) vind je op de productpagina onder "Documenten", per land en taal. Het analysecertificaat (CoA) hoort bij het batchnummer op het etiket: vul dat nummer op de productpagina in om het te downloaden. Staat er "Volgt binnenkort", of vind je het niet? Stuur ons een bericht met de productnaam en het batchnummer.',
            en: 'You can find the safety data sheet (SDS) on the product page under "Documents", per country and language. The certificate of analysis (CoA) belongs to the batch number on the label: enter that number on the product page to download it. Does it say "Coming soon", or can\'t you find it? Send us a message with the product name and batch number.',
        },
        offerContact: true,
    },
    {
        id: 'business',
        keywords: ['zakelijk', 'bedrijf', 'b2b', 'offerte', 'quote', 'grote hoeveelheid', 'bulk', 'business', 'company', 'firma', 'angebot', 'devis', 'entreprise', 'particulier', 'consument', 'private', 'afnemersverklaring', 'precursor'],
        answer: {
            nl: 'Bedrijven en instellingen kunnen een zakelijk account aanmaken. Sommige artikelen leveren wij alleen aan zakelijke klanten, zoals bepaalde precursoren voor explosieven (Verordening (EU) 2019/1148); voor sommige drugsprecursoren is vóór levering een afnemersverklaring nodig. Op de productpagina staat dan een melding.\n\nZakelijke klanten kunnen na hun eerste bestelling op rekening bestellen (betalen binnen 30 dagen). Op producten met staffelkorting krijg je vanaf 2 stuks 5% en vanaf 6 stuks 10% korting; dat telt op over alle producten met staffelkorting in je winkelwagen. Veel artikelen tegelijk bestellen kan met Snelbestellen: artikelnummers invullen, een lijst plakken of een Excel-bestand uploaden.\n\nVoor een offerte of grote hoeveelheden: stuur ons een bericht.',
            en: 'Companies and institutions can create a business account. Some items are supplied to business customers only, such as certain explosives precursors (Regulation (EU) 2019/1148); some drug precursors require a customer declaration before delivery. The product page then shows a notice.\n\nBusiness customers can order on account after their first order (payment within 30 days). Products with volume discount get 5% off from 2 pieces and 10% off from 6 pieces, counted across all volume-discount products in your cart. To order many items at once, use Quick order: enter article numbers, paste a list or upload an Excel file.\n\nFor a quote or large quantities: send us a message.',
        },
        offerContact: true,
    },
    {
        id: 'discount',
        keywords: ['staffel', 'korting', 'discount', 'rabatt', 'remise', 'mengenkorting', 'volume', 'goedkoper', 'cheaper'],
        answer: {
            nl: 'Op producten met staffelkorting krijg je vanaf 2 stuks 5% en vanaf 6 stuks 10% korting. Dat telt op over alle producten met staffelkorting in je winkelwagen, en de korting wordt automatisch verrekend. Op de productpagina zie je of een product staffelkorting heeft.\n\nVoor grote hoeveelheden kun je ook een offerte vragen: stuur ons een bericht.',
            en: 'Products with volume discount get 5% off from 2 pieces and 10% off from 6 pieces. This counts across all volume-discount products in your cart, and the discount is applied automatically. The product page shows whether a product has volume discount.\n\nFor large quantities you can also ask for a quote: send us a message.',
        },
        offerContact: true,
    },
    {
        id: 'human',
        keywords: ['medewerker', 'mens', 'persoon', 'iemand spreken', 'bellen', 'telefoon', 'contact', 'human', 'person', 'agent', 'call', 'phone', 'mitarbeiter', 'mensch', 'anrufen', 'conseiller', 'humain', 'telephone'],
        answer: {
            nl: 'Bel ons op +31 255 700 210: maandag t/m donderdag 09:00–16:00 en vrijdag 09:00–12:00. Telefonisch spreken wij Nederlands en Engels.\n\nMailen kan in elke taal naar info@laboratoriumdiscounter.nl; meestal antwoorden we binnen 24 uur. Of stuur je vraag direct aan een medewerker met de knop hieronder.',
            en: 'Call us on +31 255 700 210: Monday to Thursday 09:00–16:00 and Friday 09:00–12:00. By phone we speak Dutch and English.\n\nYou are welcome to e-mail us in any language at info@laboratoriumdiscounter.nl; we usually reply within 24 hours. Or send your question straight to our team with the button below.',
        },
        offerContact: true,
    },
];

export function faqAnswer(entry, language) {
    return entry.answer[language] || entry.answer.en;
}
