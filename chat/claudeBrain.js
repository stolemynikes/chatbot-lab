import { checkMessage } from '../safety/guard.js';
import { interpret } from './interpreter.js';
import { testReply } from './testBrain.js';
import { SUPPORTED_LANGUAGES } from '../safety/texts.js';

// Claude mode: Claude reads the message, Kasper answers with the fixed texts and cards.
//   1. The safety filter runs first (no AI). A blocked message never reaches Claude.
//   2. Claude fills in the form (topic, product, order number, e-mail).
//   3. Kasper answers from the form. When Claude is not available (no credit, timeout, ...),
//      Kasper simply answers like in test mode.
export function createClaudeReply({ apiKey, model }) {
    return async function claudeReply(conversation, text, deps) {
        if (!checkMessage(text).allowed) return testReply(conversation, text, deps);

        const waitingFor = { orderNumber: 'an order number', email: 'the e-mail address of the order', product: 'a product name' }[conversation.state];
        const understood = await interpret(text, { apiKey, model, waitingFor });
        if (!understood) console.log('Claude not available, answering with keywords');

        // The customer writes in another language: Kasper switches to it. Languages without fixed texts
        // (yet) get English, which more people read than Dutch.
        if (understood?.language) {
            const language = SUPPORTED_LANGUAGES.includes(understood.language) ? understood.language : 'en';
            if (language !== conversation.language) conversation.language = language;
        }
        return testReply(conversation, text, deps, understood);
    };
}
