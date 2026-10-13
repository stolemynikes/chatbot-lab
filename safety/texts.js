// Fixed texts that the bot always uses word for word (never written by AI).
// Add a language by copying the "en" block. Missing languages fall back to English.

export const SUPPORTED_LANGUAGES = ['nl', 'en', 'de', 'fr'];

const texts = {
    nl: {
        languageSwitched: 'Prima, we gaan verder in het Nederlands.',
        greeting: "Hoi! Ik ben Casper, de chatbot van Laboratoriumdiscounter. Waarmee kan ik je helpen?",
        followUp: "Kan ik je nog ergens anders mee helpen?",
        noThanks: "Nee, bedankt",
        goodbye: "Graag gedaan! Fijne dag nog. Je kunt de chat altijd weer openen als je nog een vraag hebt.",
        welcome: 'Hoi! Ik ben Casper 👋 Kies hieronder een onderwerp of typ zelf je vraag.',
        refuseChemical:
            'Sorry, vragen over het gebruik, mengen, bereiden of de werking van chemicaliën kan ik niet beantwoorden. Informatie over veilig gebruik vind je in het veiligheidsinformatieblad (SDS) bij het product. Heb je een andere vraag over je bestelling?',
        refuseHarm: 'Hier kan ik je niet mee helpen. Ik beantwoord alleen vragen over bestellingen, verzending, retour en facturen.',
        emergency:
            'Is er iets misgegaan met een chemische stof? Bel bij gevaar direct 112. Bel anders je huisarts of de huisartsenpost. Lees ook hoofdstuk 4 ("Eerstehulpmaatregelen") van het veiligheidsinformatieblad (SDS) van het product en houd de verpakking bij de hand.',
        selfHarm:
            'Het spijt me dat je je zo voelt. Je hoeft dit niet alleen te doen. Praat erover met iemand: bel gratis 0800-0113 of chat via 113.nl (dag en nacht). Bij direct gevaar: bel 112.',
        notUnderstood: 'Sorry, dat begreep ik niet helemaal. Kies een onderwerp hieronder, of stel je vraag op een andere manier.',
        askOrderNumber: 'Ik zoek je bestelling graag op. Wat is je ordernummer? Je vindt het in de bevestigingsmail (bijvoorbeeld LD1004).',
        askOrderEmail: 'Dank je. Wat is het e-mailadres waarmee je de bestelling hebt geplaatst?',
        badOrderNumber: 'Dat lijkt geen geldig ordernummer. Het staat in je bevestigingsmail, bijvoorbeeld LD1004.',
        badEmail: 'Dat lijkt geen geldig e-mailadres. Probeer het nog eens.',
        orderNotFound: 'Ik kan geen bestelling vinden met dit ordernummer en e-mailadres. Controleer beide gegevens en probeer het opnieuw.',
        tooManyLookups: 'Het lukt niet om je bestelling te vinden. Stuur ons een bericht, dan zoeken we het voor je uit.',
        lookupError: 'Ik kan je bestelling op dit moment niet ophalen. Probeer het later nog eens of stuur ons een bericht.',
        askProduct: 'Van welk product wil je de beschikbaarheid weten? Typ de productnaam.',
        productNone: 'Ik kon geen product vinden met die naam. Probeer een andere zoekterm of kijk in de webshop.',
        productIntro: 'Dit heb ik gevonden:',
        splitQuestion:
            'Niet alles uit je bestelling is op voorraad. Wil je dat we nu alvast versturen wat er is, en de rest later (backorder)? Of wacht je liever tot alles binnen is?',
        splitNow: 'Nu versturen wat er is',
        splitWait: 'Alles samen versturen',
        splitSavedNow: 'Genoteerd: we versturen wat op voorraad is zo snel mogelijk, de rest volgt zodra het binnen is. Als er extra kosten aan verbonden zijn, nemen we eerst contact met je op.',
        splitSavedWait: 'Genoteerd: we wachten tot alles op voorraad is en versturen het dan in één keer.',
        splitNotPossible: 'Voor deze bestelling kan ik de verzendkeuze niet (meer) aanpassen. Stuur ons een bericht als je iets wilt wijzigen.',
        contactOffer: 'Kom je er niet uit? Stuur ons een bericht, dan helpen we je per e-mail verder.',
        contactButton: '✉️ Vraag het een medewerker',
        contactThanks: 'Bedankt! We hebben je bericht ontvangen en reageren zo snel mogelijk per e-mail.',
        contactError: 'Je bericht kon niet worden verstuurd. Mail ons direct op info@laboratoriumdiscounter.nl.',
        contactLimit: 'Je hebt al een bericht gestuurd. We reageren zo snel mogelijk.',
        conversationLimit: 'Dit gesprek is te lang geworden. Stuur ons een bericht of begin een nieuw gesprek.',
        topics: ['Waar is mijn bestelling?', 'Op voorraad?', 'Verzending', 'Retourneren', 'Factuur'],
        status: {
            unfulfilled: 'wordt klaargemaakt voor verzending',
            partially_fulfilled: 'is deels verzonden',
            fulfilled: 'is verzonden',
            cancelled: 'is geannuleerd',
            on_hold: 'staat tijdelijk in de wacht',
        },
        orderLine: (name, status) => `Je bestelling ${name} ${status}.`,
    },
    en: {
        languageSwitched: "Sure, let's continue in English.",
        greeting: "Hi there! I'm Casper, the chatbot of Laboratoriumdiscounter. How can I help you?",
        followUp: "Is there anything else I can help you with?",
        noThanks: "No, thanks",
        goodbye: "You're welcome! Have a nice day. You can open the chat again any time.",
        welcome: "Hi! I'm Casper 👋 Pick a topic below or type your own question.",
        refuseChemical:
            "Sorry, I can't answer questions about using, mixing, preparing or the effects of chemicals. You can find information on safe use in the safety data sheet (SDS) on the product page. Do you have another question about your order?",
        refuseHarm: "I can't help with that. I only answer questions about orders, shipping, returns and invoices.",
        emergency:
            'Did something go wrong with a chemical? In an emergency, call 112 (or your local emergency number) right away. Otherwise contact a doctor. Also read section 4 ("First-aid measures") of the product\'s safety data sheet (SDS) and keep the packaging at hand.',
        selfHarm:
            "I'm sorry you're feeling this way. You don't have to go through this alone. Please talk to someone: in the Netherlands call 0800-0113 or chat at 113.nl (24/7); elsewhere contact your local crisis line. In immediate danger, call 112.",
        notUnderstood: "Sorry, I didn't quite get that. Pick a topic below, or ask your question in a different way.",
        askOrderNumber: "I'll gladly look up your order. What is your order number? You can find it in the confirmation e-mail (for example LD1004).",
        askOrderEmail: 'Thanks. What e-mail address did you use for the order?',
        badOrderNumber: "That doesn't look like a valid order number. You can find it in your confirmation e-mail, for example LD1004.",
        badEmail: "That doesn't look like a valid e-mail address. Please try again.",
        orderNotFound: "I can't find an order with this order number and e-mail address. Please check both and try again.",
        tooManyLookups: "I can't find your order. Send us a message and we'll look into it for you.",
        lookupError: "I can't fetch your order right now. Please try again later or send us a message.",
        askProduct: 'Which product would you like to check? Type the product name.',
        productNone: "I couldn't find a product with that name. Try another search term or browse the shop.",
        productIntro: 'This is what I found:',
        splitQuestion:
            "Not everything in your order is in stock. Would you like us to send what we have now and the rest later (backorder)? Or would you rather wait until everything is in stock?",
        splitNow: 'Send what is in stock now',
        splitWait: 'Send everything together',
        splitSavedNow: "Noted: we'll ship what is in stock as soon as possible, and the rest follows when it arrives. If this involves extra costs, we'll contact you first.",
        splitSavedWait: "Noted: we'll wait until everything is in stock and ship it all at once.",
        splitNotPossible: "I can't change the shipping choice for this order (anymore). Send us a message if you'd like to change something.",
        contactOffer: "Can't find what you need? Send us a message and we'll help you by e-mail.",
        contactButton: '✉️ Ask our team',
        contactThanks: "Thank you! We've received your message and will reply by e-mail as soon as possible.",
        contactError: 'Your message could not be sent. Please e-mail us at info@laboratoriumdiscounter.nl.',
        contactLimit: "You've already sent a message. We'll reply as soon as possible.",
        conversationLimit: 'This conversation has become too long. Send us a message or start a new conversation.',
        topics: ['Where is my order?', 'In stock?', 'Shipping', 'Returns', 'Invoice'],
        status: {
            unfulfilled: 'is being prepared for shipping',
            partially_fulfilled: 'has been partly shipped',
            fulfilled: 'has been shipped',
            cancelled: 'has been cancelled',
            on_hold: 'is temporarily on hold',
        },
        orderLine: (name, status) => `Your order ${name} ${status}.`,
    },
    de: {
        languageSwitched: 'Gerne, wir machen auf Deutsch weiter.',
        greeting: "Hallo! Ich bin Casper, der Chatbot von Laboratoriumdiscounter. Wie kann ich Ihnen helfen?",
        followUp: "Kann ich Ihnen sonst noch helfen?",
        noThanks: "Nein, danke",
        goodbye: "Gern geschehen! Einen schönen Tag noch. Sie können den Chat jederzeit wieder öffnen.",
        welcome: 'Hallo! Ich bin Casper 👋 Wählen Sie unten ein Thema oder schreiben Sie Ihre Frage.',
        refuseChemical:
            'Leider kann ich keine Fragen zur Verwendung, zum Mischen, zur Herstellung oder zur Wirkung von Chemikalien beantworten. Informationen zur sicheren Verwendung finden Sie im Sicherheitsdatenblatt (SDB) auf der Produktseite. Haben Sie eine andere Frage zu Ihrer Bestellung?',
        refuseHarm: 'Dabei kann ich nicht helfen. Ich beantworte nur Fragen zu Bestellungen, Versand, Rücksendungen und Rechnungen.',
        emergency:
            'Ist etwas mit einer Chemikalie schiefgegangen? Rufen Sie im Notfall sofort 112 an, sonst einen Arzt oder den Giftnotruf. Lesen Sie auch Abschnitt 4 („Erste-Hilfe-Maßnahmen“) des Sicherheitsdatenblatts und halten Sie die Verpackung bereit.',
        selfHarm:
            'Es tut mir leid, dass es Ihnen so geht. Sie müssen das nicht allein durchstehen. Sprechen Sie mit jemandem, z. B. der Telefonseelsorge (0800 111 0 111, rund um die Uhr). Bei akuter Gefahr: 112.',
        notUnderstood: 'Entschuldigung, das habe ich nicht ganz verstanden. Wählen Sie unten ein Thema oder formulieren Sie Ihre Frage anders.',
        askOrderNumber: 'Gern suche ich Ihre Bestellung. Wie lautet Ihre Bestellnummer? Sie steht in der Bestätigungs-E-Mail (z. B. LD1004).',
        askOrderEmail: 'Danke. Mit welcher E-Mail-Adresse haben Sie bestellt?',
        badOrderNumber: 'Das scheint keine gültige Bestellnummer zu sein. Sie steht in Ihrer Bestätigungs-E-Mail, z. B. LD1004.',
        badEmail: 'Das scheint keine gültige E-Mail-Adresse zu sein. Bitte versuchen Sie es erneut.',
        orderNotFound: 'Ich finde keine Bestellung mit dieser Bestellnummer und E-Mail-Adresse. Bitte prüfen Sie beides.',
        tooManyLookups: 'Ich kann Ihre Bestellung nicht finden. Senden Sie uns eine Nachricht, wir kümmern uns darum.',
        lookupError: 'Ich kann Ihre Bestellung gerade nicht abrufen. Bitte versuchen Sie es später erneut oder senden Sie uns eine Nachricht.',
        askProduct: 'Für welches Produkt möchten Sie die Verfügbarkeit prüfen? Geben Sie den Produktnamen ein.',
        productNone: 'Ich habe kein Produkt mit diesem Namen gefunden. Versuchen Sie einen anderen Suchbegriff.',
        productIntro: 'Das habe ich gefunden:',
        splitQuestion:
            'Nicht alle Artikel Ihrer Bestellung sind auf Lager. Sollen wir jetzt schon versenden, was da ist, und den Rest später (Nachlieferung)? Oder möchten Sie lieber warten, bis alles da ist?',
        splitNow: 'Jetzt versenden, was da ist',
        splitWait: 'Alles zusammen versenden',
        splitSavedNow: 'Notiert: Wir versenden die vorrätigen Artikel so schnell wie möglich, der Rest folgt. Falls dabei Zusatzkosten entstehen, melden wir uns vorher.',
        splitSavedWait: 'Notiert: Wir warten, bis alles auf Lager ist, und versenden dann alles zusammen.',
        splitNotPossible: 'Für diese Bestellung kann ich die Versandwahl nicht (mehr) ändern. Senden Sie uns eine Nachricht.',
        contactOffer: 'Kommen Sie nicht weiter? Senden Sie uns eine Nachricht, wir helfen Ihnen per E-Mail.',
        contactButton: '✉️ Einen Mitarbeiter fragen',
        contactThanks: 'Vielen Dank! Wir haben Ihre Nachricht erhalten und antworten so schnell wie möglich per E-Mail.',
        contactError: 'Ihre Nachricht konnte nicht gesendet werden. Bitte schreiben Sie an info@laboratoriumdiscounter.nl.',
        contactLimit: 'Sie haben bereits eine Nachricht gesendet. Wir antworten so schnell wie möglich.',
        conversationLimit: 'Dieses Gespräch ist zu lang geworden. Senden Sie uns eine Nachricht oder beginnen Sie ein neues Gespräch.',
        topics: ['Wo ist meine Bestellung?', 'Auf Lager?', 'Versand', 'Rücksendung', 'Rechnung'],
        status: {
            unfulfilled: 'wird für den Versand vorbereitet',
            partially_fulfilled: 'wurde teilweise versendet',
            fulfilled: 'wurde versendet',
            cancelled: 'wurde storniert',
            on_hold: 'ist vorübergehend angehalten',
        },
        orderLine: (name, status) => `Ihre Bestellung ${name} ${status}.`,
    },
    fr: {
        languageSwitched: "D'accord, continuons en français.",
        greeting: "Bonjour ! Je suis Casper, le chatbot de Laboratoriumdiscounter. Comment puis-je vous aider ?",
        followUp: "Puis-je vous aider pour autre chose ?",
        noThanks: "Non, merci",
        goodbye: "Avec plaisir ! Bonne journée. Vous pouvez rouvrir le chat à tout moment.",
        welcome: 'Bonjour ! Je suis Casper 👋 Choisissez un sujet ci-dessous ou écrivez votre question.',
        refuseChemical:
            "Désolé, je ne peux pas répondre aux questions sur l'utilisation, le mélange, la préparation ou les effets des produits chimiques. Vous trouverez les informations sur l'utilisation sûre dans la fiche de données de sécurité (FDS) sur la page du produit. Avez-vous une autre question sur votre commande ?",
        refuseHarm: "Je ne peux pas vous aider avec cela. Je réponds uniquement aux questions sur les commandes, la livraison, les retours et les factures.",
        emergency:
            "Un problème avec un produit chimique ? En cas d'urgence, appelez immédiatement le 112, sinon un médecin ou le centre antipoison. Lisez aussi la section 4 (« Premiers secours ») de la fiche de données de sécurité et gardez l'emballage à portée de main.",
        selfHarm:
            "Je suis désolé que vous vous sentiez ainsi. Vous n'êtes pas seul. Parlez-en à quelqu'un, par exemple au 3114 (France, 24h/24) ou à une ligne d'écoute de votre pays. En cas de danger immédiat : 112.",
        notUnderstood: "Désolé, je n'ai pas bien compris. Choisissez un sujet ci-dessous ou reformulez votre question.",
        askOrderNumber: "Je recherche volontiers votre commande. Quel est votre numéro de commande ? Il figure dans l'e-mail de confirmation (par exemple LD1004).",
        askOrderEmail: 'Merci. Quelle adresse e-mail avez-vous utilisée pour la commande ?',
        badOrderNumber: "Cela ne ressemble pas à un numéro de commande valide. Il figure dans votre e-mail de confirmation, par exemple LD1004.",
        badEmail: "Cela ne ressemble pas à une adresse e-mail valide. Veuillez réessayer.",
        orderNotFound: "Je ne trouve aucune commande avec ce numéro et cette adresse e-mail. Veuillez vérifier les deux.",
        tooManyLookups: "Je ne trouve pas votre commande. Envoyez-nous un message et nous nous en occuperons.",
        lookupError: "Je ne peux pas récupérer votre commande pour le moment. Réessayez plus tard ou envoyez-nous un message.",
        askProduct: 'Pour quel produit souhaitez-vous vérifier la disponibilité ? Tapez le nom du produit.',
        productNone: "Je n'ai trouvé aucun produit portant ce nom. Essayez un autre terme.",
        productIntro: "Voici ce que j'ai trouvé :",
        splitQuestion:
            "Tous les articles de votre commande ne sont pas en stock. Souhaitez-vous que nous envoyions maintenant ce qui est disponible et le reste plus tard ? Ou préférez-vous attendre que tout soit en stock ?",
        splitNow: 'Envoyer maintenant ce qui est en stock',
        splitWait: 'Tout envoyer ensemble',
        splitSavedNow: "C'est noté : nous expédions dès que possible ce qui est en stock, le reste suivra. En cas de frais supplémentaires, nous vous contacterons d'abord.",
        splitSavedWait: "C'est noté : nous attendons que tout soit en stock et expédions tout en une fois.",
        splitNotPossible: "Je ne peux pas (plus) modifier le choix d'expédition pour cette commande. Envoyez-nous un message.",
        contactOffer: "Vous ne trouvez pas de réponse ? Envoyez-nous un message, nous vous aiderons par e-mail.",
        contactButton: '✉️ Demander à un conseiller',
        contactThanks: 'Merci ! Nous avons bien reçu votre message et répondrons par e-mail dès que possible.',
        contactError: "Votre message n'a pas pu être envoyé. Écrivez-nous à info@laboratoriumdiscounter.nl.",
        contactLimit: 'Vous avez déjà envoyé un message. Nous répondrons dès que possible.',
        conversationLimit: 'Cette conversation est devenue trop longue. Envoyez-nous un message ou commencez une nouvelle conversation.',
        topics: ['Où est ma commande ?', 'En stock ?', 'Livraison', 'Retours', 'Facture'],
        status: {
            unfulfilled: "est en cours de préparation pour l'expédition",
            partially_fulfilled: 'a été partiellement expédiée',
            fulfilled: 'a été expédiée',
            cancelled: 'a été annulée',
            on_hold: 'est temporairement en attente',
        },
        orderLine: (name, status) => `Votre commande ${name} ${status}.`,
    },
};

// Picks a supported language from e.g. "nl-NL" or "de", English when unknown
export function pickLanguage(code) {
    const short = String(code || '').slice(0, 2).toLowerCase();
    return SUPPORTED_LANGUAGES.includes(short) ? short : 'en';
}

export function t(language) {
    return texts[language] || texts.en;
}
