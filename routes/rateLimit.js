// Who is the visitor? Used for the brakes below.
// Behind the Cloudflare Tunnel every request comes from the tunnel, so the real visitor address is taken from the
// Cf-Connecting-IP header that Cloudflare adds. That header is only trusted when TRUST_CLOUDFLARE=true:
// without the tunnel anyone could send a fake one and get around the brakes.
let trustCloudflare = false;

export function setTrustCloudflare(trust) {
    trustCloudflare = Boolean(trust);
}

export function visitorKey(req) {
    return (trustCloudflare && req.get('cf-connecting-ip')) || req.ip;
}

// A simple brake: at most `max` requests per `minutes` per visitor (IP address).
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

// Counts something per visitor within a time window: failed order lookups (so nobody can guess orders by starting
// new conversations), or contact requests (so nobody can flood info@).
export function visitorBrake({ max = 10, minutes = 60, label = 'Brake' } = {}) {
    const counts = new Map();
    setInterval(() => counts.clear(), minutes * 60 * 1000).unref();
    return {
        allowed: (key) => (counts.get(key) ?? 0) < max,
        count: (key) => {
            const count = (counts.get(key) ?? 0) + 1;
            counts.set(key, count);
            if (count === max) console.log(`${label}: ${key} reached ${max} in ${minutes} minutes`);
        },
    };
}
