// A simple brake: at most `max` requests per `minutes` per visitor (IP address).
// Behind Cloudflare Tunnel the real visitor address comes from the Cf-Connecting-IP header.
export function visitorKey(req) {
    return req.get('cf-connecting-ip') || req.ip;
}

export function rateLimit({ max = 30, minutes = 1 } = {}) {
    const hits = new Map();
    setInterval(() => hits.clear(), minutes * 60 * 1000).unref();

    return (req, res, next) => {
        const key = visitorKey(req);
        const count = (hits.get(key) ?? 0) + 1;
        hits.set(key, count);
        if (count === max + 1) console.log(`Rate limit: ${key} made more than ${max} requests to ${req.baseUrl}`);
        if (count > max) return res.status(429).send({ message: 'Too many requests, please try again later' });
        next();
    };
}

// Counts failed order lookups per visitor, so nobody can guess orders by starting new conversations.
export function lookupBrake({ maxFailures = 10, minutes = 60 } = {}) {
    const failures = new Map();
    setInterval(() => failures.clear(), minutes * 60 * 1000).unref();
    return {
        allowed: (key) => (failures.get(key) ?? 0) < maxFailures,
        failed: (key) => {
            const count = (failures.get(key) ?? 0) + 1;
            failures.set(key, count);
            if (count === maxFailures) console.log(`Order lookups blocked for ${key}: ${maxFailures} failed attempts`);
        },
    };
}
