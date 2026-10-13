import { checkMessage, normalize } from '../safety/guard.js';
import { t } from '../safety/texts.js';
import { faq, faqAnswer } from '../content/faq.js';
import { findOrderNumber, findEmail, findOrder, findProducts } from '../shopify/orders.js';

// Casper's answers. Always the fixed texts and cards, never text written by AI.
// How the question is understood:
//   test mode   - keywords (free, no AI)
//   claude mode - Claude fills in a form (`understood`, see chat/interpreter.js); when Claude is not
//                 available or not sure, the keywords are used as before
//
// reply() returns: { text, followUp?, quickReplies?: [label], buttons?: [{ id, label }], contactOffer?: true }
// followUp is a second message ("anything else?") shown after a finished answer.

const orderWords = /\b(bestelling|bestellingen|order|orders|zending|pakket|pakketje|track|trace|tracking|bestellung|sendung|paket|commande|colis|suivi|backorder)\b/;
// Only a greeting, nothing else ("hoi", "hallo!", "goedemorgen", "hi there")
const greetingWords = /^(hoi|hoii+|hallo|hallo daar|hey|heey+|hi|hi there|hello|hello there|hai|yo|goede(morgen|middag|navond)|goeie(morgen|middag|navond)|good (morning|afternoon|evening)|guten (morgen|tag|abend)|moin|servus|bonjour|bonsoir|salut|hola|ciao)( casper)?[ ,.!]*$/;
// How a greeting starts, in the EU languages (without accents: cześć -> czesc, olá -> ola)
const greetingStart = /^(hoi|hallo|hey|hi|hello|hai|yo|goede|goeie|good|guten|moin|servus|gruss|bonjour|bonsoir|salut|hola|buenos|buenas|buongiorno|buonasera|ciao|salve|ola|bom dia|boa tarde|hej|hejsan|moi|terve|hei|goddag|god morgen|czesc|dzien dobry|ahoj|dobry den|dobr|szia|jo napot|buna|tere|labas|sveiki|zdravo|dober dan|dobar dan|zdravei|zdraveite|γεια|καλημερα|здравей|добър ден|dia dhuit|bongu|merhaba)\b/;
const goodbyeWords = /^(nee|neen|no|nein|non)?[ ,.!]*(dank je( wel)?|dankjewel|bedankt|thanks|thank you|danke( schon)?|merci( beaucoup)?|dat was (het|alles)|that'?s (it|all)|das wars?|c'?est tout)?[ ,.!]*$/;
const stockWords = /\b(op voorraad|voorraad|leverbaar|beschikbaar|in stock|available|availability|auf lager|lieferbar|verfugbar|en stock|disponible)\b/;

export async function testReply(conversation, text, deps, understood = null) {
    const words = t(conversation.language);

    // 1. Safety first, on every message, whatever the bot was waiting for
    const safety = checkMessage(text);
    if (!safety.allowed) {
        conversation.state = null;
        console.log(`Blocked message (${safety.category}) in conversation ${conversation.id.slice(0, 8)}`);
        if (safety.category === 'selfHarm') return { text: words.selfHarm };
        if (safety.category === 'emergency') return { text: words.emergency };
        if (safety.category === 'harm') return { text: words.refuseHarm };
        return { text: words.refuseChemical, contactOffer: true };
    }

    // 2. What Claude understood (claude mode only)
    if (understood) {
        const answer = await understoodReply(conversation, text, deps, understood);
        if (answer) return answer;
    }

    const plain = normalize(text);

    // 3. The customer answers a question the bot asked
    if (conversation.state === 'orderNumber' || conversation.state === 'email') {
        const answer = await continueOrderLookup(conversation, text, deps);
        if (answer) return answer;
    }
    if (conversation.state === 'product') {
        conversation.state = null;
        return productAnswer(conversation, text, deps);
    }

    // 4. A new question
    if (orderWords.test(plain) || (findOrderNumber(text) && findEmail(text))) return startOrderLookup(conversation, text, deps);

    if (stockWords.test(plain)) {
        const product = stripStockWords(plain);
        if (product.length >= 3) return productAnswer(conversation, product, deps);
        conversation.state = 'product';
        return { text: words.askProduct };
    }

    // Just "hoi": Casper introduces himself and shows the topics
    if (greetingWords.test(plain)) {
        return { text: words.greeting, quickReplies: words.topics };
    }

    // "No, thanks" / "Thank you": friendly goodbye
    if (goodbyeWords.test(plain)) {
        conversation.state = null;
        return { text: words.goodbye };
    }

    const entry = bestFaq(plain);
    if (entry) {
        conversation.misunderstood = 0;
        return finished({ text: faqAnswer(entry, conversation.language), contactOffer: entry.offerContact || undefined }, words);
    }

    // 5. Not understood
    return notUnderstood(conversation);
}

// "Sorry, I did not understand": show the topics, and after two misses offer the contact form
function notUnderstood(conversation) {
    const words = t(conversation.language);
    conversation.misunderstood += 1;
    return { text: words.notUnderstood, quickReplies: words.topics, contactOffer: conversation.misunderstood >= 2 || undefined };
}

// Answers from Claude's form. Returns null when the keywords should decide instead.
async function understoodReply(conversation, text, deps, understood) {
    const words = t(conversation.language);
    const { intent, orderNumber, email } = understood;
    // The order number / e-mail Claude found, added to the text so the normal (checked) lookup reads them
    const withDetails = [text, orderNumber, email].filter(Boolean).join(' ');

    // Claude is a second safety check: it can only make Casper stricter, never less strict
    const refusal = { chemical_advice: { text: words.refuseChemical, contactOffer: true }, harmful: { text: words.refuseHarm }, emergency: { text: words.emergency }, self_harm: { text: words.selfHarm } }[intent];
    if (refusal) {
        stopOrderLookup(conversation);
        console.log(`Blocked by Claude (${intent}) in conversation ${conversation.id.slice(0, 8)}`);
        return refusal;
    }

    // Answers to a question Casper asked
    if (conversation.state === 'orderNumber' || conversation.state === 'email') {
        if (intent === 'order_details' || intent === 'order_status' || orderNumber || email) return continueOrderLookup(conversation, withDetails, deps);
        if (intent === 'unclear') return null;
        stopOrderLookup(conversation); // the customer moved on to something else
    }
    if (conversation.state === 'product') {
        conversation.state = null;
        if (intent === 'stock' || intent === 'unclear') return productAnswer(conversation, understood.productQuery || text, deps, text);
    }

    switch (intent) {
        case 'order_status':
        case 'order_details':
            return startOrderLookup(conversation, withDetails, deps);
        case 'stock':
            if (!understood.productQuery) {
                conversation.state = 'product';
                return { text: words.askProduct };
            }
            return productAnswer(conversation, understood.productQuery, deps, text);
        case 'faq': {
            const entry = faq.find((item) => item.id === understood.faqTopic);
            if (!entry) return null;
            conversation.misunderstood = 0;
            return finished({ text: faqAnswer(entry, conversation.language), contactOffer: entry.offerContact || undefined }, words);
        }
        case 'greeting':
            // Claude sometimes calls an unknown word a greeting. Only a short message that starts with
            // a real greeting word counts; anything else is checked by the keywords
            if (text.trim().split(/\s+/).length > 3 || !greetingStart.test(normalize(text))) return null;
            return { text: words.greeting, quickReplies: words.topics };
        case 'off_topic':
            return notUnderstood(conversation);
        case 'goodbye':
            conversation.state = null;
            return { text: words.goodbye };
        default:
            return null; // unclear: let the keywords try
    }
}

// "Where is my order?": use the order we already know, or ask for the order number (and e-mail)
function startOrderLookup(conversation, text, deps) {
    const words = t(conversation.language);
    const orderNumber = findOrderNumber(text);
    if (conversation.order && !orderNumber) return orderAnswer(conversation, conversation.order, deps);
    conversation.state = 'orderNumber';
    conversation.pendingOrderNumber = null;
    conversation.badAnswers = 0;
    if (!orderNumber) return { text: words.askOrderNumber };
    return continueOrderLookup(conversation, text, deps);
}

// Adds "Can I help you with anything else?" + the topics and a "No, thanks" button to a finished answer
export function finished(answer, words) {
    return { ...answer, followUp: words.followUp, quickReplies: [...words.topics, words.noThanks] };
}

// "Is ethanol op voorraad?" -> "ethanol"
function stripStockWords(plain) {
    return plain.replace(stockWords, '').replace(/\b(is|zijn|het|de|dit|heb|hebben|jullie|you|have|do|is it|ist|est-ce que|avez-vous|nog|still|wieder|encore|\?)\b/g, '').replace(/[?!.]/g, '').trim();
}

// The FAQ entry with the most keyword hits, or null
function bestFaq(plain) {
    let best = null;
    let bestHits = 0;
    for (const entry of faq) {
        const hits = entry.keywords.filter((keyword) => plain.includes(keyword)).length;
        if (hits > bestHits) {
            best = entry;
            bestHits = hits;
        }
    }
    return best;
}

// A message that is clearly a new question, not an answer to "what is your order number / e-mail?"
function isNewQuestion(plain) {
    return stockWords.test(plain) || orderWords.test(plain) || greetingWords.test(plain) || goodbyeWords.test(plain) || Boolean(bestFaq(plain));
}

function stopOrderLookup(conversation) {
    conversation.state = null;
    conversation.pendingOrderNumber = null;
    conversation.badAnswers = 0;
}

// Asks for the order number, then the e-mail address, then looks the order up.
// Returns null when the message is not an answer to the question (so it can be handled as a new question).
async function continueOrderLookup(conversation, text, deps) {
    const words = t(conversation.language);
    const orderNumber = findOrderNumber(text);
    const email = findEmail(text);

    if (orderNumber) conversation.pendingOrderNumber = orderNumber;

    // Not an order number / e-mail address: maybe the customer asked something else in the meantime,
    // or gave a useless answer. Never keep asking forever.
    const notAnAnswer = (badText) => {
        if (isNewQuestion(normalize(text))) {
            stopOrderLookup(conversation);
            return null; // handled as a new question
        }
        conversation.badAnswers += 1;
        if (conversation.badAnswers >= 2) {
            stopOrderLookup(conversation);
            return { text: words.notUnderstood, quickReplies: words.topics, contactOffer: true };
        }
        return { text: badText };
    };

    if (!conversation.pendingOrderNumber) return notAnAnswer(words.badOrderNumber);
    if (!email) {
        // First time (or a new order number): ask for the e-mail address
        if (conversation.state !== 'email' || orderNumber) {
            conversation.state = 'email';
            conversation.badAnswers = 0;
            return { text: words.askOrderEmail };
        }
        return notAnAnswer(words.badEmail);
    }

    // Both known: look it up (with brakes against guessing)
    conversation.state = null;
    const orderName = conversation.pendingOrderNumber;
    conversation.pendingOrderNumber = null;

    if (conversation.failedLookups >= deps.limits.maxOrderLookupFailures || !deps.lookupAllowed()) {
        return { text: words.tooManyLookups, contactOffer: true };
    }

    let order;
    try {
        order = await findOrder(deps.shopify, { orderNumber: orderName, email, useFake: deps.useFakeShopify });
    } catch (error) {
        console.log(`Order lookup failed: ${error.message}`);
        return { text: words.lookupError, contactOffer: true };
    }

    if (!order) {
        conversation.failedLookups += 1;
        deps.lookupFailed();
        if (conversation.failedLookups >= deps.limits.maxOrderLookupFailures) return { text: words.tooManyLookups, contactOffer: true };
        conversation.state = 'orderNumber';
        return { text: `${words.orderNotFound} ${words.askOrderNumber}` };
    }

    conversation.order = order;
    return orderAnswer(conversation, order, deps);
}

function orderAnswer(conversation, order, deps) {
    const words = t(conversation.language);
    const text = words.orderLine(order.name, words.status[order.status] || order.status.replace(/_/g, ' '));
    const card = orderCard(order);

    if (order.canSplit && deps.splitMode !== 'off') {
        return {
            text,
            order: card,
            question: words.splitQuestion, // shown under the order card
            buttons: [
                { id: 'split-now', label: words.splitNow },
                { id: 'split-wait', label: words.splitWait },
            ],
        };
    }
    return finished({ text, order: card }, words);
}

// What the widget needs for the order card. Leaves out internal things like the Shopify id.
// Item state: shipped / preparing / backorder (not in stock yet) / cancelled
function orderCard(order) {
    return {
        name: order.name,
        date: order.date,
        status: order.status,
        total: order.total,
        tracking: order.tracking,
        items: order.items.map((item) => ({
            title: item.title,
            variant: item.variant,
            quantity: item.quantity,
            image: item.image,
            state: order.status === 'cancelled' ? 'cancelled' : item.short > 0 ? 'backorder' : item.waiting > 0 ? 'preparing' : 'shipped',
        })),
    };
}

async function productAnswer(conversation, text, deps, fallbackText = null) {
    const words = t(conversation.language);
    let products;
    try {
        products = await findProducts(deps.shopify, { text, useFake: deps.useFakeShopify, country: conversation.country });
        if (products.length === 0 && fallbackText && fallbackText !== text) {
            products = await findProducts(deps.shopify, { text: stripStockWords(normalize(fallbackText)), useFake: deps.useFakeShopify, country: conversation.country });
        }
    } catch (error) {
        console.log(`Product search failed: ${error.message}`);
        return { text: words.lookupError };
    }
    if (products.length === 0) return finished({ text: words.productNone }, words);
    // The widget shows these as product cards (picture, name, stock, price)
    return finished({ text: words.productIntro, products }, words);
}
