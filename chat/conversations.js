import crypto from 'node:crypto';

// Conversations are kept in memory only (nothing on disk). They disappear after a period of no activity
// or when the server restarts. The customer's browser only holds a random conversation id.
export class Conversations {
    constructor({ idleMinutes = 120, maxConversations = 10_000 } = {}) {
        this.items = new Map();
        this.idleMs = idleMinutes * 60 * 1000;
        this.maxConversations = maxConversations;
        setInterval(() => this.removeOld(), 5 * 60 * 1000).unref();
    }

    // country: the visitor's country (two capitals, e.g. NL), used for delivery times
    start(language, country = 'NL') {
        this.removeOld();
        // A brake against someone filling the memory with empty conversations
        if (this.items.size >= this.maxConversations) {
            const oldest = this.items.keys().next().value;
            this.items.delete(oldest);
        }
        const conversation = {
            id: crypto.randomBytes(24).toString('base64url'),
            language,
            country: /^[A-Z]{2}$/.test(country) ? country : 'NL',
            state: null, // what the bot is waiting for: 'orderNumber' | 'email' | 'product'
            pendingOrderNumber: null,
            order: null, // the one order this customer has proven is theirs (number + e-mail)
            failedLookups: 0,
            badAnswers: 0, // useless answers to the order number / e-mail question
            misunderstood: 0,
            messageCount: 0,
            contactRequests: 0,
            transcript: [],
            lastActive: Date.now(),
        };
        this.items.set(conversation.id, conversation);
        return conversation;
    }

    get(id) {
        if (typeof id !== 'string' || id.length > 64) return null;
        const conversation = this.items.get(id);
        if (!conversation || Date.now() - conversation.lastActive > this.idleMs) return null;
        conversation.lastActive = Date.now();
        return conversation;
    }

    removeOld() {
        const now = Date.now();
        for (const [id, conversation] of this.items) {
            if (now - conversation.lastActive > this.idleMs) this.items.delete(id);
        }
    }
}
