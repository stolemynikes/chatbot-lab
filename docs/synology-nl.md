# Casper op de Synology NAS – test in de teststore

Stap voor stap Casper op de Synology zetten en laten verschijnen in de **teststore** (`hevjuq-bg.myshopify.com`).
De teststore staat achter een wachtwoord, dus klanten zien nog niets.

```
teststore (Shopify) ──laadt widget.js──> Cloudflare quick tunnel (https) ──> Casper op de NAS
                                                                              ├─> Shopify API
                                                                              └─> Claude API
```

- Je hoeft **niets** open te zetten in de router. Casper heeft geen open poort; alleen de tunnel kan erbij.
- Je hebt **geen Cloudflare-account** nodig: de "quick tunnel" geeft een willekeurig adres zoals
  `https://lucky-words-here.trycloudflare.com`. **Dat adres verandert na elke herstart** van de NAS of het project.
  Voor de echte livegang maken we een vaste tunnel met een eigen adres.

Wat je nodig hebt: de NAS met **DSM 7.2** of nieuwer en **Container Manager** (staat er al voor de factuur-app).
Ongeveer een half uur.

---

## 1. Een eigen gebruiker voor Casper

Casper krijgt een eigen gebruiker zonder beheerrechten, net als de factuur-app.

1. **Configuratiescherm → Gebruiker en groep → Maken**:
   - Naam: `casper`, met een lang willekeurig wachtwoord (je hoeft er nooit mee in te loggen)
   - Groep: alleen `users`
   - Rechten: **Lezen/schrijven** op `docker`, **Geen toegang** op alle andere mappen (ook niet op `facturen`)
   - Toepassingen: alles **weigeren**
2. **Het gebruikersnummer opzoeken** (eenmalig, via SSH):
   - Configuratiescherm → Terminal en SNMP → **SSH-service inschakelen**
   - Op je pc, in PowerShell: `ssh <jouw-beheerdersnaam>@<ip-van-de-nas>`
   - Typ: `id casper`. Je ziet iets als `uid=1028(casper) gid=100(users)`.
   - Onthoud de twee getallen, en **zet SSH daarna weer uit**.

## 2. De bestanden op de NAS zetten

1. Op de pc, in de projectmap: `node scripts/makeNasPackage.js`. Dat maakt **`build/casper-nas.zip`**
   (zonder `.env`, `node_modules`, `data` en tests).
2. Maak via **File Station** in de map `docker` een map **`casper`**, en pak de zip daarin uit.
3. Zet je **`.env`** van de pc ook in `docker/casper`. Pas daarin aan, of voeg toe:
   ```
   PUID=1028                    ← het eerste getal uit stap 1
   PGID=100                     ← het tweede getal uit stap 1
   SPLIT_SHIPMENT_MODE=off
   ALLOWED_ORIGINS=https://hevjuq-bg.myshopify.com
   ```
4. Maak in `docker/casper` een lege map **`data`**.
5. Rechtsklik op `docker/casper` → Eigenschappen → Machtiging → gebruiker `casper` **Lezen/schrijven**.

> `.env` bevat je geheime sleutels (Shopify, Claude). Zet hem alleen in `docker/casper`, nergens anders.

## 3. Starten

1. **Container Manager → Project → Maken**:
   - Projectnaam: `casper`
   - Pad: `docker/casper`
   - Bron: **gebruik het bestaande docker-compose.yml**
2. Klik door en **start** het project. De eerste keer duurt het bouwen een paar minuten.
3. **Container → casper → Logboek**. Je hoort te zien:
   - `Chatbot running on port 8090 (test page off)`
   - `Mode: claude (claude-haiku-5-5), Shopify: hevjuq-bg.myshopify.com, partial shipping: off, ...`
   - `Behind the Cloudflare Tunnel: visitor addresses come from Cloudflare`
   - `Chat allowed on: https://hevjuq-bg.myshopify.com`
4. **Container → casper-tunnel → Logboek**. Zoek de regel met **`trycloudflare.com`**, bijvoorbeeld:
   `Your quick Tunnel has been created! Visit it at: https://lucky-words-here.trycloudflare.com`
   Dat is het adres van Casper. Controleer: open `https://<dat-adres>/health` in je browser → je ziet **ok**.

Ziet Casper een fout in de instellingen, dan staat in het logboek precies welke regel in `.env` ontbreekt.

## 4. Casper in de teststore zetten

1. Shopify-admin van de teststore → **Webwinkel → Thema's** → bij het thema → **⋯ → Code bewerken**.
2. Open **`layout/theme.liquid`**. Zoek helemaal onderaan **`</body>`**.
3. Plak **direct boven** `</body>` deze regel (met het adres uit stap 3.4):
   ```html
   <script src="https://lucky-words-here.trycloudflare.com/widget.js" defer></script>
   ```
4. **Opslaan**. Open de teststore (met het winkelwachtwoord): rechtsonder staat de chatknop.

**Na een herstart** van de NAS of het project heeft de tunnel een **nieuw adres**: zoek het opnieuw op (stap 3.4)
en vervang het in `theme.liquid`.

## 5. Een nieuwe versie zetten

1. Op de pc: `node scripts/makeNasPackage.js`
2. Vervang de bestanden in `docker/casper` door de inhoud van de nieuwe zip (**niet** `.env` en **niet** `data`).
3. **Container Manager → Project → casper → Bouwen** en opnieuw starten.
4. Nieuw tunneladres opzoeken en in `theme.liquid` zetten (stap 3.4 en 4).

## 6. Stoppen

**Container Manager → Project → casper → Stoppen.** De chatknop verdwijnt dan vanzelf uit de teststore
(het script kan niet meer laden); de winkel zelf werkt gewoon door. Haal de regel uit `theme.liquid` weg als je
klaar bent met testen.

---

### Goed om te weten

- **Deels verzenden staat uit** (`SPLIT_SHIPMENT_MODE=off`): in de stand `log` zegt Casper "Genoteerd" terwijl er nog
  niets met de keuze gebeurt.
- **Contactberichten** worden (zolang e-mail uit staat) bewaard in `docker/casper/data/contact-requests` en na 90 dagen
  automatisch verwijderd.
- **Kosten**: elke vraag aan Casper gaat naar Claude (Haiku). Zet in de Anthropic-console een maandlimiet.
- Het tunneladres is willekeurig maar wel openbaar: wie het kent, kan Casper gebruiken. Voor een test is dat geen
  probleem (Casper laat geen orders zien zonder ordernummer + e-mail). Voor livegang komt er een vaste tunnel met
  extra beveiliging bij Cloudflare.
