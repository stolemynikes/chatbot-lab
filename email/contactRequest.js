import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

// Sends the customer's question + the chat to the shop (info@).
// When e-mail is off (EMAIL_ENABLED=false) the request is saved as a file instead, so nothing gets lost while testing.
export function createContactSender(contact) {
    const transport = contact.email.enabled
        ? nodemailer.createTransport({
              host: contact.email.host,
              port: contact.email.port,
              secure: contact.email.port === 465,
              requireTLS: contact.email.port !== 465, // never send unencrypted
              auth: { user: contact.email.user, pass: contact.email.password },
              connectionTimeout: 20_000,
          })
        : null;

    return async function sendContactRequest({ name, email, message, conversation }) {
        const transcript = conversation.transcript.map((line) => `${line.from === 'customer' ? 'Klant' : 'Bot'}: ${line.text}`).join('\n\n');
        const text = [
            `Naam: ${name}`,
            `E-mail: ${email}`,
            `Taal: ${conversation.language}`,
            `Geverifieerde bestelling: ${conversation.order?.name ?? '(geen)'}`,
            '',
            'Bericht:',
            message,
            '',
            '--- Chatgesprek ---',
            transcript || '(leeg)',
        ].join('\n');

        if (!transport) {
            fs.mkdirSync(contact.saveDir, { recursive: true });
            const file = path.join(contact.saveDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}.txt`);
            fs.writeFileSync(file, text, 'utf8');
            console.log(`Contact request saved to ${file} (EMAIL_ENABLED=false)`);
            return;
        }

        await transport.sendMail({
            from: contact.email.from,
            to: contact.to,
            replyTo: email, // pressing Reply answers the customer directly
            subject: `Chatbot: vraag van ${name}${conversation.order ? ` (${conversation.order.name})` : ''}`,
            text,
        });
    };
}
