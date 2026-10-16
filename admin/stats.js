import fs from 'node:fs';
import path from 'node:path';

// Kasper's numbers for the NAS admin panel, per day. Only counts, never what customers wrote.
// Kept in data/stats.json (on the Docker volume), so they survive a restart. Days are Dutch time (TZ in compose).

const KEEP_DAYS = 400;
export const COUNTERS = ['conversations', 'orderLookups', 'productQuestions', 'contactOffered', 'contactSent', 'inputTokens', 'outputTokens'];

// "2026-10-16" in local time
export const localDay = (date = new Date()) => date.toLocaleDateString('sv-SE');

export function createStats({ file = path.join(path.dirname(process.env.SETTINGS_PATH || './data/settings.json'), 'stats.json'), now = () => new Date() } = {}) {
    let days = read();
    let timer = null;

    function read() {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            return data && typeof data.days === 'object' ? data.days : {};
        } catch {
            return {};
        }
    }

    // Saving at most every few seconds: a busy chat should not write the file on every message
    function saveSoon() {
        if (timer) return;
        timer = setTimeout(() => {
            timer = null;
            save();
        }, 5000);
        timer.unref?.();
    }

    function save() {
        const cutoff = localDay(new Date(now().getTime() - KEEP_DAYS * 86_400_000));
        for (const day of Object.keys(days)) if (day < cutoff) delete days[day];
        try {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(`${file}.tmp`, JSON.stringify({ days }));
            fs.renameSync(`${file}.tmp`, file);
        } catch {
            // Numbers must never stop the chat (e.g. a full disk); they stay in memory
        }
    }

    function add(counter, amount = 1) {
        if (!COUNTERS.includes(counter) || !(amount > 0)) return;
        const day = localDay(now());
        days[day] ??= {};
        days[day][counter] = (days[day][counter] || 0) + amount;
        saveSoon();
    }

    // Totals from a first day up to today
    function total(fromDay) {
        const sum = Object.fromEntries(COUNTERS.map((c) => [c, 0]));
        for (const [day, values] of Object.entries(days)) {
            if (day < fromDay) continue;
            for (const c of COUNTERS) sum[c] += values[c] || 0;
        }
        return sum;
    }

    // Today, this week (from Monday), this calendar month, and the last 30 days one by one
    function summary() {
        const today = now();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const last30 = [];
        for (let i = 29; i >= 0; i -= 1) {
            const day = localDay(new Date(today.getTime() - i * 86_400_000));
            last30.push({ day, ...Object.fromEntries(COUNTERS.map((c) => [c, days[day]?.[c] || 0])) });
        }
        return { today: total(localDay(today)), week: total(localDay(monday)), month: total(localDay(firstOfMonth)), last30 };
    }

    return { add, summary, save };
}
