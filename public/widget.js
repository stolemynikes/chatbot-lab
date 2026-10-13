// Chat widget for the shop website. Add it to a page with:
//   <script src="https://<chatbot address>/widget.js" defer></script>
// Optional: data-language="nl" (otherwise the page language is used).
//
// Safety: all text is shown with textContent (never innerHTML), so nothing a customer types
// or Shopify sends can run as code on the website. Only http(s) links become clickable.
(function () {
    'use strict';
    if (window.__ldChatLoaded) return;
    window.__ldChatLoaded = true;

    var script = document.currentScript;
    var api = new URL('/api/chat', script ? script.src : location.href).href;
    // Language of the website (Shopify sets it on the page), otherwise the browser's language
    var language = (script && script.dataset.language) || (window.Shopify && window.Shopify.locale) || document.documentElement.lang || navigator.language || 'en';
    // The visitor's country: on the shop Shopify knows it (window.Shopify.country), otherwise the Netherlands
    var country = String((script && script.dataset.country) || (window.Shopify && window.Shopify.country) || 'NL').toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) country = 'NL';
    var conversationId = null;
    var busy = false;

    var labels = {
        nl: { title: 'Casper · Klantenservice', placeholder: 'Typ je vraag...', send: 'Verstuur', name: 'Naam', email: 'E-mailadres', message: 'Je vraag', formIntro: 'Een medewerker van onze klantenservice leest je vraag en antwoordt per e-mail.', cancel: 'Annuleren', open: 'Chat openen', close: 'Sluiten', houseBrand: 'Huismerk', from: 'vanaf', stockIn: 'Op voorraad', stockAvail: 'Leverbaar', stockOut: 'Niet op voorraad', days: 'Levertijd naar {country}: {range} werkdagen', weeks: 'Levertijd naar {country}: {range} weken', restart: 'Het gesprek is verlopen. Ik start een nieuw gesprek.', offline: 'De chat is even niet bereikbaar. Mail ons op info@laboratoriumdiscounter.nl.' },
        en: { title: 'Casper · Customer service', placeholder: 'Type your question...', send: 'Send', name: 'Name', email: 'E-mail address', message: 'Your question', formIntro: 'Someone from our customer service team will read your question and reply by e-mail.', cancel: 'Cancel', open: 'Open chat', close: 'Close', houseBrand: 'House brand', from: 'from', stockIn: 'In stock', stockAvail: 'Available', stockOut: 'Out of stock', days: 'Delivery to {country}: {range} working days', weeks: 'Delivery to {country}: {range} weeks', restart: 'The conversation expired. Starting a new one.', offline: 'The chat is not available right now. E-mail us at info@laboratoriumdiscounter.nl.' },
        de: { title: 'Casper · Kundenservice', placeholder: 'Ihre Frage...', send: 'Senden', name: 'Name', email: 'E-Mail-Adresse', message: 'Ihre Frage', formIntro: 'Ein Mitarbeiter unseres Kundenservice liest Ihre Frage und antwortet per E-Mail.', cancel: 'Abbrechen', open: 'Chat öffnen', close: 'Schließen', houseBrand: 'Eigenmarke', from: 'ab', stockIn: 'Auf Lager', stockAvail: 'Lieferbar', stockOut: 'Nicht auf Lager', days: 'Lieferzeit nach {country}: {range} Werktage', weeks: 'Lieferzeit nach {country}: {range} Wochen', restart: 'Das Gespräch ist abgelaufen. Ich starte ein neues.', offline: 'Der Chat ist gerade nicht erreichbar. Schreiben Sie an info@laboratoriumdiscounter.nl.' },
        fr: { title: 'Casper · Service client', placeholder: 'Votre question...', send: 'Envoyer', name: 'Nom', email: 'Adresse e-mail', message: 'Votre question', formIntro: 'Un conseiller de notre service client lira votre question et vous répondra par e-mail.', cancel: 'Annuler', open: 'Ouvrir le chat', close: 'Fermer', houseBrand: 'Marque maison', from: 'à partir de', stockIn: 'En stock', stockAvail: 'Disponible', stockOut: 'Rupture de stock', days: 'Livraison vers {country} : {range} jours ouvrés', weeks: 'Livraison vers {country} : {range} semaines', restart: 'La conversation a expiré. Nouvelle conversation.', offline: "Le chat n'est pas disponible. Écrivez à info@laboratoriumdiscounter.nl." },
    };
    // Texts on the order card
    var orderLabels = {
        nl: { orderedOn: 'Besteld op', total: 'Totaal', track: 'Volg je pakket', status: { fulfilled: 'Verzonden', partially_fulfilled: 'Deels verzonden', unfulfilled: 'In behandeling', cancelled: 'Geannuleerd', on_hold: 'In de wacht' }, item: { shipped: 'Verzonden', preparing: 'Wordt klaargemaakt', backorder: 'Nog niet op voorraad', cancelled: 'Geannuleerd' } },
        en: { orderedOn: 'Ordered on', total: 'Total', track: 'Track your parcel', status: { fulfilled: 'Shipped', partially_fulfilled: 'Partly shipped', unfulfilled: 'Processing', cancelled: 'Cancelled', on_hold: 'On hold' }, item: { shipped: 'Shipped', preparing: 'Being prepared', backorder: 'Not in stock yet', cancelled: 'Cancelled' } },
        de: { orderedOn: 'Bestellt am', total: 'Gesamt', track: 'Sendung verfolgen', status: { fulfilled: 'Versendet', partially_fulfilled: 'Teilweise versendet', unfulfilled: 'In Bearbeitung', cancelled: 'Storniert', on_hold: 'Angehalten' }, item: { shipped: 'Versendet', preparing: 'Wird vorbereitet', backorder: 'Noch nicht auf Lager', cancelled: 'Storniert' } },
        fr: { orderedOn: 'Commandé le', total: 'Total', track: 'Suivre mon colis', status: { fulfilled: 'Expédiée', partially_fulfilled: 'Partiellement expédiée', unfulfilled: 'En traitement', cancelled: 'Annulée', on_hold: 'En attente' }, item: { shipped: 'Expédié', preparing: 'En préparation', backorder: 'Pas encore en stock', cancelled: 'Annulé' } },
    };
    var languageNames = { nl: 'Nederlands', en: 'English', de: 'Deutsch', fr: 'Français' };
    language = language.slice(0, 2).toLowerCase();
    if (!labels[language]) language = 'en';
    var L = labels[language];
    var contactLabel = null; // the "send a message" button text, comes from the server

    // The chosen language is remembered in this browser only (a convenience; the chat works without it)
    var savedLanguage = null;
    try {
        savedLanguage = localStorage.getItem('ldc-language');
    } catch (e) {}
    if (!labels[savedLanguage]) savedLanguage = null;

    var css =
        '#ldc-btn{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:0;background:#1e4475;color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:2147483000;font-size:26px;line-height:56px}' +
        '#ldc-box{position:fixed;right:20px;bottom:88px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 110px);background:#fff;color:#1d1d1f;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
        '#ldc-box.open{display:flex}' +
        '#ldc-head{background:#1e4475;color:#fff;padding:12px 14px;font-weight:600;display:flex;justify-content:space-between;align-items:center}' +
        '#ldc-head button{background:none;border:0;color:#fff;font-size:20px;cursor:pointer;min-width:36px;min-height:36px}' +
        '#ldc-log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:12px;background:#f5f6f8;position:relative}' +
        '.ldc-msg{max-width:85%;margin:6px 0;padding:8px 11px;border-radius:10px;white-space:pre-wrap;word-wrap:break-word}' +
        '.ldc-bot{background:#fff;border:1px solid #e3e5e8}' +
        '.ldc-me{background:#1e4475;color:#fff;margin-left:auto}' +
        '.ldc-msg a{color:inherit;text-decoration:underline}' +
        '.ldc-row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}' +
        '.ldc-chip{border:1px solid #1e4475;background:#fff;color:#1e4475;border-radius:16px;padding:5px 11px;cursor:pointer;font:inherit}' +
        '.ldc-chip:disabled{opacity:.5;cursor:default}' +
        '#ldc-form{display:flex;border-top:1px solid #e3e5e8}' +
        '#ldc-input{flex:1;min-width:0;border:0;padding:12px;font:inherit;font-size:16px;outline:none}' +
        '#ldc-send{border:0;background:#1e4475;color:#fff;padding:0 16px;cursor:pointer;font:inherit}' +
        '.ldc-contact{background:#fff;border:1px solid #e3e5e8;border-radius:10px;padding:10px;margin:6px 0;display:flex;flex-direction:column;gap:6px}' +
        '.ldc-contact input,.ldc-contact textarea{border:1px solid #c9ccd1;border-radius:6px;padding:7px;font:inherit}' +
        '.ldc-contact textarea{min-height:80px;resize:vertical}' +
        '.ldc-contact-intro{margin:0 0 2px;font-size:13px;color:#4b5563}' +
        '.ldc-cards{display:flex;flex-direction:column;gap:8px;margin:6px 0;max-width:92%}' +
        '.ldc-card{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #e3e5e8;border-radius:12px;padding:8px 10px;text-decoration:none;color:#1d1d1f;transition:border-color .15s,box-shadow .15s}' +
        '.ldc-card img,.ldc-noimg{width:56px;height:56px;object-fit:contain;flex:none;border-radius:6px;background:#f5f6f8}' +
        '.ldc-card-body{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}' +
        '.ldc-card-title{color:#1e4475;font-size:13px;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
        '.ldc-card-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
        '.ldc-badge{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#1a7f37;white-space:nowrap}' +
        '.ldc-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}' +
        '.ldc-badge.out{color:#b35900}' +
        '.ldc-badge.avail{color:#1e63b5}' +
        '.ldc-delivery{font-size:12px;color:#6b7280}' +
        '.ldc-price{font-size:13px;font-weight:700;color:#1e4475;white-space:nowrap}' +
        '.ldc-price small{font-weight:400;color:#6b7280;margin-right:3px}' +
        '.ldc-house{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;background:#1e4475;color:#fff;font-size:11px;font-weight:700;padding:2px 8px 2px 6px;border-radius:10px}' +
        '.ldc-house-logo{width:11px;height:14px;flex:none}' +
        '.ldc-order{background:#fff;border:1px solid #e3e5e8;border-radius:12px;margin:6px 0;max-width:92%;overflow:hidden}' +
        '.ldc-order-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:10px 12px;border-bottom:1px solid #eef0f2}' +
        '.ldc-order-name{font-weight:700;color:#1e4475}' +
        '.ldc-order-date{font-size:12px;color:#6b7280}' +
        '.ldc-pill{font-size:12px;font-weight:600;padding:3px 9px;border-radius:12px;white-space:nowrap;background:#e8eef7;color:#1e4475}' +
        '.ldc-pill.fulfilled{background:#e6f4ea;color:#1a7f37}' +
        '.ldc-pill.partially_fulfilled,.ldc-pill.on_hold{background:#fff4e5;color:#b35900}' +
        '.ldc-pill.cancelled{background:#f1f1f1;color:#6b7280}' +
        '.ldc-item{display:flex;gap:10px;align-items:center;padding:8px 12px}' +
        '.ldc-item + .ldc-item{border-top:1px solid #f3f4f6}' +
        '.ldc-item img,.ldc-item .ldc-noimg{width:44px;height:44px}' +
        '.ldc-item-title{font-size:13px;line-height:1.3;color:#1d1d1f}' +
        '.ldc-item-sub{font-size:12px;color:#6b7280}' +
        '.ldc-badge.wait{color:#1e4475}' +
        '.ldc-badge.gray{color:#6b7280}' +
        '.ldc-order-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid #eef0f2;background:#fafbfc}' +
        '.ldc-track{display:inline-block;background:#1e4475;color:#fff;text-decoration:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600}' +
        // Micro animations (switched off for visitors who ask their system for less motion)
        '@keyframes ldc-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
        '@keyframes ldc-pop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}' +
        '@keyframes ldc-pop-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(12px) scale(.97)}}' +
        '@keyframes ldc-up{from{transform:translateY(100%)}to{transform:none}}' +
        '@keyframes ldc-down{from{transform:none}to{transform:translateY(100%)}}' +
        '@keyframes ldc-dot{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-4px);opacity:1}}' +
        '.ldc-in{animation:ldc-in .28s ease-out backwards}' +
        '#ldc-box.open{animation:ldc-pop .32s cubic-bezier(.22,1,.36,1);transform-origin:bottom right}' +
        '#ldc-box.ldc-closing{animation:ldc-pop-out .18s ease-in forwards}' +
        '#ldc-head .ldc-lang{display:inline-flex;align-items:center;gap:6px;min-width:0;min-height:0;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-radius:16px;padding:4px 9px 4px 6px;color:#fff;font:inherit;font-size:13px;font-weight:600;cursor:pointer}' +
        '.ldc-flag{display:inline-block;width:20px;height:14px;border-radius:2px;overflow:hidden;flex:none;box-shadow:0 0 0 1px rgba(0,0,0,.15)}' +
        '.ldc-flag svg{display:block;width:100%;height:100%}' +
        '.ldc-chev{width:10px;height:6px;transition:transform .2s}' +
        '.ldc-lang[aria-expanded=true] .ldc-chev{transform:rotate(180deg)}' +
        '.ldc-lang-menu{position:absolute;right:12px;background:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:4px;display:none;z-index:2;min-width:180px}' +
        '.ldc-lang-menu.open{display:block;animation:ldc-in .18s ease-out}' +
        '.ldc-lang-item{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;padding:10px;border-radius:7px;font:inherit;color:#1d1d1f;cursor:pointer;text-align:left}' +
        '.ldc-lang-item[aria-current=true]{font-weight:700;color:#1e4475}' +
        '.ldc-check{margin-left:auto;color:#1e4475}' +
        '#ldc-head > span:last-child{display:flex;align-items:center;gap:6px}' +
        '.ldc-typing{display:inline-flex;gap:4px;align-items:center;padding:11px 13px}' +
        '.ldc-typing span{width:7px;height:7px;border-radius:50%;background:#9aa3ad;animation:ldc-dot 1.1s infinite ease-in-out}' +
        '.ldc-typing span:nth-child(2){animation-delay:.15s}' +
        '.ldc-typing span:nth-child(3){animation-delay:.3s}' +
        '#ldc-btn{transition:transform .15s ease,box-shadow .15s ease}' +
        '.ldc-chip{transition:background .15s,color .15s,transform .1s}' +
        '.ldc-chip:active:not(:disabled),#ldc-send:active,.ldc-track:active{transform:scale(.96)}' +
        '.ldc-card{transition:border-color .15s,box-shadow .15s,transform .15s}' +
        '@media (hover:hover){' +
        '.ldc-card:hover{border-color:#1e4475;box-shadow:0 2px 8px rgba(30,68,117,.15);transform:translateY(-1px)}' +
        '.ldc-track:hover{background:#163558}' +
        '#ldc-btn:hover{transform:scale(1.06);box-shadow:0 6px 18px rgba(0,0,0,.3)}' +
        '.ldc-chip:hover:not(:disabled){background:#1e4475;color:#fff}' +
        '.ldc-lang-item:hover{background:#f1f4f9}' +
        '#ldc-head .ldc-lang:hover{background:rgba(255,255,255,.22)}' +
        '}' +
        // Phones: the chat fills the whole screen, bigger buttons for thumbs, room for the iPhone notch and home bar
        '@media (max-width:520px){' +
        '#ldc-box{top:0;right:0;bottom:0;left:0;width:100%;max-width:none;height:100%;max-height:none;border-radius:0;box-shadow:none}' +
        '#ldc-box.open{animation:ldc-up .4s cubic-bezier(.22,1,.36,1)}' +
        '#ldc-box.ldc-closing{animation:ldc-down .28s cubic-bezier(.4,0,1,1) forwards}' +
        '#ldc-head .ldc-lang{padding:6px 10px 6px 8px;font-size:14px;min-height:36px}' +
        '#ldc-head{padding:calc(10px + env(safe-area-inset-top)) 10px 10px 16px;font-size:16px}' +
        '#ldc-head button{min-width:44px;min-height:44px;font-size:22px}' +
        '#ldc-form{padding-bottom:env(safe-area-inset-bottom)}' +
        '#ldc-send{padding:0 18px}' +
        '#ldc-btn{right:16px;bottom:calc(16px + env(safe-area-inset-bottom))}' +
        '#ldc-btn.ldc-hidden{display:none}' +
        '.ldc-msg{max-width:88%;font-size:15px}' +
        '.ldc-chip{padding:9px 14px;font-size:14px}' +
        '.ldc-cards,.ldc-order{max-width:100%}' +
        '.ldc-contact input,.ldc-contact textarea{font-size:16px}' +
        '}' +
        '@media (prefers-reduced-motion:reduce){#ldc-btn,#ldc-box,#ldc-box *{animation:none!important;transition:none!important}}';

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var button = el('button', { id: 'ldc-btn', type: 'button', 'aria-label': L.open }, '💬');
    var box = el('div', { id: 'ldc-box', role: 'dialog', 'aria-label': L.title });
    var closeButton = el('button', { type: 'button', 'aria-label': L.close }, '×');
    var languageButton = el('button', { type: 'button', class: 'ldc-lang', 'aria-haspopup': 'true', 'aria-expanded': 'false', title: 'Taal · Language · Sprache · Langue' });
    var languageMenu = el('div', { class: 'ldc-lang-menu', role: 'menu' });
    var head = el('div', { id: 'ldc-head' });
    var headTitle = el('span', {}, L.title);
    var headButtons = el('span');
    headButtons.appendChild(languageButton);
    headButtons.appendChild(closeButton);
    head.appendChild(headTitle);
    head.appendChild(headButtons);
    var log = el('div', { id: 'ldc-log', 'aria-live': 'polite' });
    var form = el('form', { id: 'ldc-form' });
    var input = el('input', { id: 'ldc-input', type: 'text', maxlength: '1000', placeholder: L.placeholder, autocomplete: 'off' });
    var send = el('button', { id: 'ldc-send', type: 'submit' }, L.send);
    form.appendChild(input);
    form.appendChild(send);
    box.appendChild(head);
    box.appendChild(log);
    box.appendChild(form);
    box.appendChild(languageMenu);
    updateLanguageButton();
    document.body.appendChild(button);
    document.body.appendChild(box);

    var phone = window.matchMedia ? window.matchMedia('(max-width: 520px)') : { matches: false };
    var pageOverflow = '';

    function setOpen(open) {
        if (open) {
            box.classList.remove('ldc-closing');
            box.classList.add('open');
            button.classList.add('ldc-hidden');
            if (phone.matches) {
                pageOverflow = document.documentElement.style.overflow;
                document.documentElement.style.overflow = 'hidden';
            }
            return;
        }
        if (!box.classList.contains('open') || box.classList.contains('ldc-closing')) return;
        closeMenu();
        var done = false;
        var finish = function () {
            if (done) return;
            done = true;
            box.classList.remove('open', 'ldc-closing');
            button.classList.remove('ldc-hidden');
            document.documentElement.style.overflow = pageOverflow;
        };
        if (reduceMotion) return finish();
        box.classList.add('ldc-closing');
        box.addEventListener('animationend', function end(event) {
            if (event.target !== box) return;
            box.removeEventListener('animationend', end);
            finish();
        });
        setTimeout(finish, 450); // in case the animation does not run
    }

    // Escape closes the chat
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        if (languageMenu.classList.contains('open')) closeMenu();
        else if (box.classList.contains('open')) setOpen(false);
    });

    button.addEventListener('click', function () {
        setOpen(!box.classList.contains('open'));
        if (box.classList.contains('open')) {
            if (!phone.matches) input.focus();
            // Start in the language the customer chose before (language menu), otherwise the language of the website.
            // When the customer writes in another language, Casper switches by himself.
            if (!conversationId && !log.firstChild) {
                applyLanguage(savedLanguage || language);
                start();
            }
        }
    });
    closeButton.addEventListener('click', function () {
        setOpen(false);
    });
    languageButton.addEventListener('click', function (event) {
        event.stopPropagation();
        if (languageMenu.classList.contains('open')) closeMenu();
        else openMenu();
    });
    // A click anywhere else closes the menu
    document.addEventListener('click', function (event) {
        if (languageMenu.classList.contains('open') && !languageMenu.contains(event.target)) closeMenu();
    });
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        var text = input.value.trim();
        if (!text || busy) return;
        input.value = '';
        // The conversation could not start (offline): try again
        if (!conversationId) {
            start().then(function () { ask(text); });
            return;
        }
        ask(text);
    });

    // The language menu: flag + name, the current language marked
    function openMenu() {
        languageMenu.textContent = '';
        ['nl', 'en', 'de', 'fr'].forEach(function (code) {
            var item = el('button', { type: 'button', class: 'ldc-lang-item', role: 'menuitem', 'aria-current': code === language ? 'true' : 'false' });
            item.appendChild(flag(code));
            item.appendChild(el('span', {}, languageNames[code]));
            if (code === language) item.appendChild(el('span', { class: 'ldc-check' }, '✓'));
            item.addEventListener('click', function () {
                closeMenu();
                chooseLanguage(code);
            });
            languageMenu.appendChild(item);
        });
        languageMenu.style.top = head.offsetHeight + 6 + 'px';
        languageMenu.classList.add('open');
        languageButton.setAttribute('aria-expanded', 'true');
        languageMenu.firstChild.focus();
    }

    function closeMenu() {
        languageMenu.classList.remove('open');
        languageButton.setAttribute('aria-expanded', 'false');
    }

    // Chosen in the menu: remembered in this browser. The conversation goes on in the new language.
    function chooseLanguage(code) {
        if (code === language) return;
        applyLanguage(code);
        try {
            localStorage.setItem('ldc-language', code);
        } catch (e) {}
        savedLanguage = code;
        if (!conversationId) return start();
        if (busy) return;
        busy = true;
        anchor = log.lastChild;
        return request('/language', { conversationId: conversationId, language: code })
            .then(showAnswer)
            .catch(function () { show(L.offline, 'bot'); })
            .then(function () { busy = false; });
    }

    // Small pictures drawn in code (Windows shows flag emoji as letters, so the flags are drawn too)
    function svg(viewBox, parts, extra) {
        var ns = 'http://www.w3.org/2000/svg';
        var node = document.createElementNS(ns, 'svg');
        var attributes = Object.assign({ viewBox: viewBox, 'aria-hidden': 'true', focusable: 'false' }, extra || {});
        for (var name in attributes) node.setAttribute(name, attributes[name]);
        parts.forEach(function (part) {
            var child = document.createElementNS(ns, part[0]);
            for (var key in part[1]) child.setAttribute(key, part[1][key]);
            node.appendChild(child);
        });
        return node;
    }

    function flag(code) {
        var stripes = function (colors) {
            return colors.map(function (color, i) { return ['rect', { y: i * 2, width: 9, height: 2, fill: color }]; });
        };
        var drawings = {
            nl: ['0 0 9 6', stripes(['#AE1C28', '#FFFFFF', '#21468B'])],
            de: ['0 0 9 6', stripes(['#000000', '#DD0000', '#FFCE00'])],
            fr: ['0 0 3 2', [['rect', { x: 0, width: 1, height: 2, fill: '#0055A4' }], ['rect', { x: 1, width: 1, height: 2, fill: '#FFFFFF' }], ['rect', { x: 2, width: 1, height: 2, fill: '#EF4135' }]]],
            en: ['0 0 60 30', [
                ['rect', { width: 60, height: 30, fill: '#012169' }],
                ['path', { d: 'M0,0 L60,30 M60,0 L0,30', stroke: '#FFFFFF', 'stroke-width': 6 }],
                ['path', { d: 'M0,0 L60,30 M60,0 L0,30', stroke: '#C8102E', 'stroke-width': 2 }],
                ['path', { d: 'M30,0 V30 M0,15 H60', stroke: '#FFFFFF', 'stroke-width': 10 }],
                ['path', { d: 'M30,0 V30 M0,15 H60', stroke: '#C8102E', 'stroke-width': 6 }],
            ]],
        };
        var drawing = drawings[code] || drawings.en;
        var frame = el('span', { class: 'ldc-flag' });
        frame.appendChild(svg(drawing[0], drawing[1], { preserveAspectRatio: 'xMidYMid slice' }));
        return frame;
    }

    // The button in the header: flag, language code and a "v"
    function updateLanguageButton() {
        languageButton.textContent = '';
        languageButton.appendChild(flag(language));
        languageButton.appendChild(el('span', {}, language.toUpperCase()));
        languageButton.appendChild(svg('0 0 10 6', [['path', { d: 'M1 1l4 4 4-4', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]], { class: 'ldc-chev' }));
        languageButton.setAttribute('aria-label', languageNames[language] + ' – Taal · Language · Sprache · Langue');
    }

    // Puts the widget's own texts (title, input, card labels) in another language
    function applyLanguage(code) {
        if (!labels[code]) return;
        language = code;
        L = labels[code];
        headTitle.textContent = L.title;
        input.placeholder = L.placeholder;
        send.textContent = L.send;
        closeButton.setAttribute('aria-label', L.close);
        updateLanguageButton();
    }

    function el(tag, attributes, text) {
        var node = document.createElement(tag);
        for (var name in attributes || {}) node.setAttribute(name, attributes[name]);
        if (text) node.textContent = text;
        return node;
    }

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var anchor = null; // the customer's last message: the answer below it is read from the top
    var typingBubble = null;

    function pause(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, reduceMotion ? 0 : ms); });
    }

    // Adds something to the chat with a small fade-in, and scrolls so it can be seen
    function add(node) {
        node.className += ' ldc-in';
        if (typingBubble && typingBubble.parentNode === log) log.insertBefore(node, typingBubble);
        else log.appendChild(node);
        follow();
    }

    // Scroll down to the newest message, but never so far that the start of the current answer
    // (the customer's question) disappears: long answers are read from the top
    function follow() {
        var top = log.scrollHeight - log.clientHeight;
        if (anchor && anchor.parentNode === log) top = Math.min(top, anchor.offsetTop - 8);
        if (top <= log.scrollTop) return;
        if (log.scrollTo && !reduceMotion) log.scrollTo({ top: top, behavior: 'smooth' });
        else log.scrollTop = top;
    }

    // The three bouncing dots while Casper "types"
    function typing(on) {
        if (on && !typingBubble) {
            var dots = el('div', { class: 'ldc-msg ldc-bot ldc-typing', 'aria-label': '…' });
            for (var i = 0; i < 3; i++) dots.appendChild(el('span'));
            add(dots);
            typingBubble = dots;
        } else if (!on && typingBubble) {
            typingBubble.remove();
            typingBubble = null;
        }
    }

    // Asks the server; the typing dots stay at least a moment, so a fast answer does not "jump" in
    function request(path, body) {
        typing(true);
        return Promise.all([post(path, body), pause(650)])
            .then(function (results) { return results[0]; })
            .finally(function () { typing(false); });
    }

    function post(path, body) {
        return fetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (response) {
            return response.json().then(function (data) {
                data.__status = response.status;
                return data;
            });
        });
    }

    // Shows a message; only http(s) links become clickable
    function show(text, from) {
        var bubble = el('div', { class: 'ldc-msg ' + (from === 'me' ? 'ldc-me' : 'ldc-bot') });
        String(text || '')
            .split(/(https?:\/\/[^\s]+)/g)
            .forEach(function (part) {
                if (/^https?:\/\//.test(part)) {
                    var link = el('a', { href: part, target: '_blank', rel: 'noopener noreferrer' }, part);
                    bubble.appendChild(link);
                } else if (part) {
                    bubble.appendChild(document.createTextNode(part));
                }
            });
        add(bubble);
    }

    // Shows an answer one piece at a time, like someone typing:
    //   text -> cards -> (dots) question -> buttons -> contact button -> (dots) "anything else?" -> topic buttons
    // Returns a promise that ends when everything is on screen.
    function showAnswer(answer) {
        var steps = [];
        // Casper switched language (the customer writes in another language): follow along
        if (answer.language && answer.language !== language) applyLanguage(answer.language);
        if (answer.contactLabel) contactLabel = answer.contactLabel;
        if (answer.text) steps.push(function () { show(answer.text, 'bot'); });
        if (answer.products) steps.push(function () { productCards(answer.products); return pause(250 + answer.products.length * 90); });
        if (answer.order) steps.push(function () { orderCard(answer.order); return pause(350); });
        if (answer.question) steps.push(typeThen(answer.question));
        if (answer.buttons) {
            steps.push(function () {
                row(answer.buttons.map(function (b) {
                    return { label: b.label, onClick: function () { action(b.id, b.label); } };
                }));
            });
        }
        if (answer.contactOffer) steps.push(function () { row([{ label: contactLabel || L.send, onClick: contactForm }]); return pause(150); });
        if (answer.followUp) steps.push(typeThen(answer.followUp));
        if (answer.quickReplies) {
            steps.push(function () {
                row(answer.quickReplies.map(function (label) {
                    return { label: label, onClick: function () { ask(label); } };
                }));
            });
        }
        return steps.reduce(function (chain, step) {
            return chain.then(step);
        }, Promise.resolve());
    }

    // A second message in one answer: first the typing dots, then the message
    function typeThen(text) {
        return function () {
            typing(true);
            return pause(Math.min(1100, 350 + text.length * 8)).then(function () {
                typing(false);
                show(text, 'bot');
            });
        };
    }

    // Product cards like on the website: picture, name, stock (green/orange dot) and price.
    // The whole card links to the product page. Only Shopify pictures and http(s) links are used.
    function productCards(products) {
        var list = el('div', { class: 'ldc-cards' });
        products.forEach(function (product, index) {
            var url = /^https?:\/\//.test(product.url || '') ? product.url : null;
            var card = el(url ? 'a' : 'div', url ? { class: 'ldc-card', href: url, target: '_blank', rel: 'noopener' } : { class: 'ldc-card' });
            if (/^https:\/\/cdn\.shopify\.com\//.test(product.image || '')) {
                card.appendChild(el('img', { src: product.image, alt: '', loading: 'lazy' }));
            } else {
                card.appendChild(el('span', { class: 'ldc-noimg' }));
            }
            var body = el('span', { class: 'ldc-card-body' });
            if (product.houseBrand) {
                var house = el('span', { class: 'ldc-house' });
                house.appendChild(houseLogo());
                house.appendChild(document.createTextNode(L.houseBrand));
                body.appendChild(house);
            }
            body.appendChild(el('span', { class: 'ldc-card-title' }, product.title));
            var meta = el('span', { class: 'ldc-card-meta' });
            // Same pills as the website: green "Op voorraad", blue "Leverbaar", orange "Niet op voorraad"
            var stock = { in: ['', L.stockIn], avail: [' avail', L.stockAvail], out: [' out', L.stockOut] }[product.stock];
            meta.appendChild(stock ? el('span', { class: 'ldc-badge' + stock[0] }, stock[1]) : el('span'));
            if (product.price) {
                var price = el('span', { class: 'ldc-price' });
                if (product.priceFrom) price.appendChild(el('small', {}, L.from));
                price.appendChild(document.createTextNode(formatPrice(product.price)));
                meta.appendChild(price);
            }
            body.appendChild(meta);
            if (product.delivery) body.appendChild(el('span', { class: 'ldc-delivery' }, deliveryText(product.delivery)));
            card.appendChild(body);
            card.className += ' ldc-in';
            card.style.animationDelay = index * 90 + 'ms'; // one after the other
            list.appendChild(card);
        });
        add(list);
    }

    // The own-brand logo (same as on the website), drawn in the text colour
    function houseLogo() {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        var attributes = { class: 'ldc-house-logo', viewBox: '4 0 296 383', fill: 'none', stroke: 'currentColor', 'stroke-width': '20', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
        for (var name in attributes) svg.setAttribute(name, attributes[name]);
        [
            ['path', { d: 'M108,102 C70,118 48,150 42,190 L14,250 L32,262 L30,320 L70,322 L74,380 M238,165 C254,190 256,215 244,240 L198,320 L210,380' }],
            ['path', { d: 'M131,86 L131,128 A60,60 0 1 0 163,128 L163,86 M120,86 L174,86' }],
            ['path', { d: 'M92,186 C112,176 132,176 147,186 S182,196 202,186' }],
            ['path', { d: 'M281.5,71.8 L293.8,71.4 L293.8,92.6 L281.5,92.2 L278.9,98.4 L287.9,106.9 L272.9,121.9 L264.4,112.9 L258.2,115.5 L258.6,127.8 L237.4,127.8 L237.8,115.5 L231.6,112.9 L223.1,121.9 L208.1,106.9 L217.1,98.4 L214.5,92.2 L202.2,92.6 L202.2,71.4 L214.5,71.8 L217.1,65.6 L208.1,57.1 L223.1,42.1 L231.6,51.1 L237.8,48.5 L237.4,36.2 L258.6,36.2 L258.2,48.5 L264.4,51.1 L272.9,42.1 L287.9,57.1 L278.9,65.6 Z' }],
            ['circle', { cx: '248', cy: '82', r: '14' }],
            ['circle', { cx: '130', cy: '45', r: '10' }],
            ['circle', { cx: '175', cy: '18', r: '13' }],
        ].forEach(function (part) {
            var node = document.createElementNS(ns, part[0]);
            for (var key in part[1]) node.setAttribute(key, part[1][key]);
            svg.appendChild(node);
        });
        return svg;
    }

    // Order card: number, date, status pill, items with picture and state, total and a track & trace button
    function orderCard(order) {
        var O = orderLabels[language] || orderLabels.en;
        var card = el('div', { class: 'ldc-order' });

        var head = el('div', { class: 'ldc-order-head' });
        var titleBox = el('div');
        titleBox.appendChild(el('div', { class: 'ldc-order-name' }, order.name));
        var date = formatDate(order.date);
        if (date) titleBox.appendChild(el('div', { class: 'ldc-order-date' }, O.orderedOn + ' ' + date));
        head.appendChild(titleBox);
        var statusKey = /^[a-z_]+$/.test(order.status || '') ? order.status : '';
        head.appendChild(el('span', { class: 'ldc-pill ' + statusKey }, O.status[statusKey] || order.status));
        card.appendChild(head);

        (order.items || []).forEach(function (item) {
            var row = el('div', { class: 'ldc-item' });
            if (/^https:\/\/cdn\.shopify\.com\//.test(item.image || '')) row.appendChild(el('img', { src: item.image, alt: '', loading: 'lazy' }));
            else row.appendChild(el('span', { class: 'ldc-noimg' }));
            var body = el('span', { class: 'ldc-card-body' });
            body.appendChild(el('span', { class: 'ldc-item-title' }, item.title));
            body.appendChild(el('span', { class: 'ldc-item-sub' }, item.quantity + '×' + (item.variant ? ' · ' + item.variant : '')));
            var stateClass = { shipped: '', preparing: ' wait', backorder: ' out', cancelled: ' gray' }[item.state] || ' gray';
            body.appendChild(el('span', { class: 'ldc-badge' + stateClass }, O.item[item.state] || ''));
            row.appendChild(body);
            card.appendChild(row);
        });

        var trackUrl = (order.tracking || []).map(function (t) { return t.url; }).filter(function (url) { return /^https?:\/\//.test(url || ''); })[0];
        if (order.total || trackUrl) {
            var foot = el('div', { class: 'ldc-order-foot' });
            var total = el('span', { class: 'ldc-price' });
            if (order.total) {
                total.appendChild(el('small', {}, O.total));
                total.appendChild(document.createTextNode(formatPrice(order.total)));
            }
            foot.appendChild(total);
            if (trackUrl) foot.appendChild(el('a', { class: 'ldc-track', href: trackUrl, target: '_blank', rel: 'noopener noreferrer' }, O.track));
            card.appendChild(foot);
        }

        add(card);
    }

    function formatDate(iso) {
        var date = new Date(iso);
        if (!iso || isNaN(date)) return '';
        var locale = { nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR' }[language] || 'nl-NL';
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // "Levertijd naar Nederland: 1–2 werkdagen", like the product page
    function deliveryText(delivery) {
        var range = delivery.lo === delivery.hi ? String(delivery.lo) : delivery.lo + '–' + delivery.hi;
        var name = country;
        try {
            name = new Intl.DisplayNames([language], { type: 'region' }).of(country) || country;
        } catch (e) {}
        return (delivery.unit === 'weeks' ? L.weeks : L.days).replace('{country}', name).replace('{range}', range);
    }

    function formatPrice(price) {
        var locale = { nl: 'nl-NL', en: 'en-IE', de: 'de-DE', fr: 'fr-FR' }[language] || 'nl-NL';
        try {
            return new Intl.NumberFormat(locale, { style: 'currency', currency: price.currency }).format(Number(price.amount));
        } catch (e) {
            return price.amount + ' ' + price.currency;
        }
    }

    // A row of buttons; after one click all buttons in the row are switched off
    function row(items) {
        var wrap = el('div', { class: 'ldc-row' });
        items.forEach(function (item) {
            var chip = el('button', { class: 'ldc-chip', type: 'button' }, item.label);
            chip.addEventListener('click', function () {
                Array.prototype.forEach.call(wrap.children, function (c) { c.disabled = true; });
                item.onClick();
            });
            wrap.appendChild(chip);
        });
        add(wrap);
    }

    function start() {
        busy = true;
        anchor = null;
        return request('/start', { language: language, country: country })
            .then(function (answer) {
                conversationId = answer.conversationId;
                contactLabel = answer.contactLabel || contactLabel;
                return showAnswer(answer);
            })
            .catch(function () { show(L.offline, 'bot'); })
            .then(function () { busy = false; });
    }

    function ask(text) {
        if (busy) return;
        show(text, 'me');
        anchor = log.lastChild;
        busy = true;
        request('/message', { conversationId: conversationId, text: text })
            .then(function (answer) {
                if (answer.__status === 404) {
                    show(L.restart, 'bot');
                    busy = false;
                    return start();
                }
                return showAnswer(answer);
            })
            .catch(function () { show(L.offline, 'bot'); })
            .then(function () { busy = false; });
    }

    function action(id, label) {
        if (busy) return;
        show(label, 'me');
        anchor = log.lastChild;
        busy = true;
        request('/action', { conversationId: conversationId, action: id })
            .then(showAnswer)
            .catch(function () { show(L.offline, 'bot'); })
            .then(function () { busy = false; });
    }

    function contactForm() {
        var formBox = el('form', { class: 'ldc-contact' });
        var name = el('input', { type: 'text', placeholder: L.name, maxlength: '100', required: 'required', autocomplete: 'name' });
        var email = el('input', { type: 'email', placeholder: L.email, maxlength: '254', required: 'required', autocomplete: 'email' });
        var message = el('textarea', { placeholder: L.message, maxlength: '3000', required: 'required' });
        var buttons = el('div', { class: 'ldc-row' });
        var submit = el('button', { class: 'ldc-chip', type: 'submit' }, L.send);
        var cancel = el('button', { class: 'ldc-chip', type: 'button' }, L.cancel);
        buttons.appendChild(submit);
        buttons.appendChild(cancel);
        var intro = el('p', { class: 'ldc-contact-intro' }, L.formIntro);
        [intro, name, email, message, buttons].forEach(function (node) { formBox.appendChild(node); });
        add(formBox);
        name.focus();

        cancel.addEventListener('click', function () { formBox.remove(); });
        formBox.addEventListener('submit', function (event) {
            event.preventDefault();
            submit.disabled = true;
            post('/contact', { conversationId: conversationId, name: name.value, email: email.value, message: message.value })
                .then(function (answer) {
                    formBox.remove();
                    show(answer.text || L.offline, 'bot');
                })
                .catch(function () {
                    submit.disabled = false;
                    show(L.offline, 'bot');
                });
        });
    }
})();
