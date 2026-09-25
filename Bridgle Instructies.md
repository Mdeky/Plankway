# Bridgle – projectinstructies voor Claude Code

Je bent de lead developer van **Bridgle**, een lichte, dagelijkse browserpuzzel gebaseerd op Hashiwokakero ("Bridges"), met een eigen twist. Het doel is een speelse, snelle, mobile-first webgame die commercieel gehost wordt met advertenties, tegen zo laag mogelijke hostingkosten (idealiter enkel de kost van een domeinnaam).

Werk in de mijlpalen onderaan, één per keer. Rond een mijlpaal af (werkend + getest) voor je aan de volgende begint, en geef na elke mijlpaal een korte samenvatting van wat er gebouwd is en wat de volgende stap is.

---

## 1. Het spel

### Basisregels (klassiek Hashi)
- Het speelveld is een raster met eilanden. Elk eiland heeft een getal van 1 t/m 8.
- Bruggen lopen enkel horizontaal of verticaal, in een rechte lijn, tussen twee eilanden.
- Tussen twee eilanden liggen maximaal 2 bruggen.
- Bruggen mogen elkaar niet kruisen en niet over een ander eiland lopen.
- Het aantal bruggen dat aan een eiland vastzit, is gelijk aan het getal op dat eiland.
- Alle eilanden moeten uiteindelijk één verbonden netwerk vormen.
- Elke puzzel heeft **exact één oplossing** en is **zonder gokken** oplosbaar.

### De twist: riffen
- Sommige watervakjes bevatten een **rif** (rotsen). Een brug kan niet over een rif lopen.
- Riffen worden door de generator geplaatst om het aantal mogelijke verbindingen te beperken en nieuwe deductiestappen te creëren (bv. twee eilanden die "naast elkaar lijken" maar niet verbonden kunnen worden).
- Implementeer de twist als een aparte, uitschakelbare regelmodule (`rules/reefs.ts`), zodat er later extra twists toegevoegd of uitgewisseld kunnen worden zonder de kern te herschrijven.

### Modi
- **Daily Bridgle**: elke dag dezelfde puzzel voor iedereen, genummerd (Bridgle #1 = lanceerdatum). De dag volgt de **lokale datum** van de speler, zoals bij Wordle. Moeilijkheid volgt een weekritme (maandag makkelijk → zondag moeilijkst).
- **Endless mode**: onbeperkt puzzels, lokaal gegenereerd, met oplopende moeilijkheid. Houd een level-teller en een persoonlijk record bij.

### Speelervaring
- Een puzzel duurt 2 à 6 minuten.
- Timer (zichtbaar maar niet stresserend), undo, reset.
- Hints enkel in endless mode (laat de volgende logische stap zien). Daily zonder hints, of met hint die in het resultaat vermeld wordt.
- Na het oplossen: statistieken (gespeeld, winpercentage, huidige streak, langste streak, tijdsverdeling) en een **deelbaar resultaat zonder spoilers**, bijvoorbeeld:
  ```
  Bridgle #42 🌉 2:31
  🏝️🏝️🏝️🏝️🏝️ 0 undo's
  bridgle.com
  ```
- Aftelklok tot de volgende daily.

---

## 2. Tech stack

Kies bewust voor minimale kosten, minimale dependencies en een kleine bundle.

| Onderdeel | Keuze | Reden |
|---|---|---|
| Taal | TypeScript (strict) | Eén taal voor client, generator en API |
| Monorepo | pnpm workspaces | Gedeelde kernlogica tussen web, API en scripts |
| Frontend build | Vite | Snel, kleine output |
| UI-shell (menu's, modals, stats) | Preact | ~4 KB, React-achtige API |
| Speelveld | HTML Canvas 2D, eigen renderer | Geen game-engine nodig, volledige controle over de cartoonstijl |
| Styling | Plain CSS met CSS custom properties | Geen framework-overhead, makkelijk dark mode |
| Hosting frontend | Cloudflare Pages | Gratis, onbeperkte bandbreedte, CDN |
| API | Cloudflare Workers (Hono als router) | Gratis tier (100k requests/dag) |
| Database | Cloudflare D1 (SQLite) | Gratis tier ruim voldoende voor profielen en resultaten |
| Daily-generatie | Node-CLI-script, gedraaid via GitHub Actions (cron) | Workers op het gratis plan hebben te weinig CPU-tijd voor generatie |
| Endless-generatie | In de browser, in een Web Worker | Nul serverkosten, UI blijft vloeiend |
| Offline | PWA (service worker, manifest) | Endless werkt offline, installeerbaar op gsm |
| Analytics | Cloudflare Web Analytics | Gratis, cookieloos |
| Tests | Vitest (core), Playwright (enkele e2e-rooktests) | |

Voeg geen extra dependencies toe zonder dit eerst voor te stellen en te motiveren. Budget: initiële JS < 100 KB gzip (exclusief advertentiescripts).

### Projectstructuur
```
bridgle/
  packages/core/        # pure TS, geen DOM: model, regels, solver, generator, seeded RNG
  apps/web/             # Vite + Preact + canvas renderer
  apps/api/             # Cloudflare Worker (Hono) + D1-migraties
  scripts/              # CLI: daily puzzels genereren en naar D1 schrijven
  .github/workflows/    # CI + cron voor daily-generatie
```

---

## 3. Puzzelgeneratie (packages/core)

### Datamodel
- `Puzzle { id, width, height, islands: {x,y,n}[], reefs: {x,y}[], difficulty, seed }`
- `Solution`: lijst van `{a, b, count}` (index van eilanden, 1 of 2 bruggen).
- Serialiseer compact (JSON) zodat een puzzel < 2 KB is.

### Seeded RNG
- Gebruik een deterministische PRNG (bv. mulberry32 of xoshiro128**) met een string-seed. Nooit `Math.random()` in core.

### Generator (constructief)
1. Start met één eiland op een willekeurige positie.
2. Kies herhaaldelijk een bestaand eiland, een richting en een afstand; plaats daar een nieuw eiland als dat kan zonder bestaande bruggen of eilanden te kruisen, en leg 1 of 2 bruggen.
3. Stop bij het doelaantal eilanden (afhankelijk van moeilijkheid en rastergrootte).
4. Leid de getallen af uit de gelegde bruggen.
5. Plaats riffen op watervakjes die géén brug van de oplossing blokkeren, bij voorkeur op plekken waar ze alternatieve verbindingen uitsluiten.
6. Controleer met de solver: exact één oplossing, oplosbaar met enkel logische deductie. Anders: verwerpen of riffen/eilanden bijsturen en opnieuw controleren.

### Solver
- **Logische solver** met mensachtige technieken, elk met een moeilijkheidsgewicht, bv.:
  - eiland met exact genoeg buren voor zijn getal (verzadiging)
  - "n = 2 × aantal buren" → alle dubbele bruggen
  - minimale bruggen per buur afleiden uit restcapaciteit
  - kruisingen uitsluiten
  - isolatiepreventie (geen gesloten deelnetwerken vormen)
  - rif-gerelateerde uitsluitingen
- **Backtracking-solver** die oplossingen telt tot 2, om uniciteit te garanderen.
- De moeilijkheidsscore = hoogste gebruikte techniek + aantal stappen. Hiermee kiezen we puzzels per weekdag en per endless-level.
- De logische solver levert ook de **hints** (volgende deductiestap + uitleg).

### Moeilijkheidscurve
- Daily: maandag 7×7 met ~10 eilanden, oplopend tot zondag 10×10 met ~22 eilanden en meer riffen.
- Endless: begint klein, schaalt per level; na level ~30 plafonneren op "moeilijk" met variatie.

### Kwaliteit
- Unit tests voor alle regels, solvertechnieken en een property-test: 1000 gegenereerde puzzels → allemaal uniek oplosbaar en valide.
- Een benchmarkscript: gemiddelde generatietijd per moeilijkheid (doel endless: < 300 ms op een middelmatige gsm).

---

## 4. Daily-pipeline en API

### Daily generatie
- `scripts/generate-daily.ts` genereert de puzzels voor de komende 14 dagen die nog ontbreken, en schrijft ze naar D1 via `wrangler d1 execute` (of de D1 HTTP API).
- GitHub Actions draait dit dagelijks. Bij falen: de buffer van 14 dagen vangt het op.

### Endpoints (Hono)
- `GET /api/daily/:date` → puzzel voor die datum. Geef enkel puzzels terug voor datums ≤ vandaag + 1 dag (UTC+14), zodat toekomstige puzzels niet uitlekken. Geef **nooit** de oplossing mee.
- `POST /api/profile` → maakt een anoniem profiel, geeft profiel-id + geheim token terug.
- `POST /api/daily/:number/result` → { tijd, undo's, oplossing }. De server valideert de oplossing tegen de regels, slaat het resultaat op en berekent de streak.
- `GET /api/profile/stats` → statistieken en streaks.
- `POST /api/profile/recover` → profiel herstellen met herstelcode.
- `DELETE /api/profile` → profiel en alle data verwijderen (GDPR).

### Profielen en streaks
- Standaard **anoniem**: bij eerste bezoek wordt een profiel aangemaakt; het token staat in een httpOnly, Secure, SameSite=Lax cookie.
- Toon een **herstelcode** (bv. 4 woorden) die de speler kan bewaren om het profiel op een ander toestel te koppelen. Geen e-mail, geen wachtwoorden in fase 1.
- Later (optioneel): passkeys (WebAuthn) om toestellen te koppelen.
- Streak = aantal opeenvolgende daily-nummers opgelost. Resultaten worden eerst lokaal (IndexedDB) opgeslagen en daarna gesynchroniseerd, zodat offline spelen de streak niet breekt.
- Rate limiting op profielcreatie en resultaatinzending.

### D1-schema (startpunt)
- `puzzles(number PK, date UNIQUE, data JSON, difficulty)`
- `profiles(id PK, token_hash, recovery_hash, created_at)`
- `results(profile_id, puzzle_number, time_ms, undos, hints, solved_at, PK(profile_id, puzzle_number))`
- Sla tokens en herstelcodes enkel gehasht op.

---

## 5. Visuele stijl

Sfeer: vrolijk, zacht, cartoonachtig. Een kleine eilandenwereld op een kalme zee.

- **Water**: zachte blauwgroene gradient met subtiele, trage golfjes (geanimeerde lijntjes of ruis). Rastercellen niet expliciet tonen; eventueel een heel vage stippenraster ter oriëntatie.
- **Eilanden**: organische, licht onregelmatige blobvormen (per eiland seeded, dus altijd hetzelfde), met een zandrand en een groen midden. Kleine decoratie per eiland (palmboom, rots, hutje), deterministisch gekozen. Het getal staat groot en goed leesbaar op een houten bordje of een witte cirkel.
- **Riffen**: groepjes grijze rotsen met wat schuim eromheen.
- **Bruggen**: houten planken met touwleuningen, licht handgetekend (kleine seeded wobble). Een dubbele brug = twee parallelle bruggen. Bij het leggen: planken verschijnen kort na elkaar ("klik-klik-klik"-animatie, ~200 ms). Bij verwijderen: kleine plons.
- **Feedback**: een eiland dat exact vol zit krijgt een klein vlaggetje of wordt lichtjes groener; een eiland met te veel bruggen kleurt oranje-rood. Kleur is nooit de enige indicator (ook icoon/vorm), voor kleurenblinden.
- **Winst**: bootje vaart door het beeld, meeuwen, zon komt door. Kort, overslaanbaar.
- **Dark mode**: nachtversie (donkerblauwe zee, maanlicht, lichtgevende getallen), volgt `prefers-color-scheme` met manuele toggle.
- Alles tekenen in code (Canvas-paden). Geen externe afbeeldingen of fonts met onduidelijke licentie. Eén webfont met open licentie (bv. via self-hosting) of een systeemfontstack.
- Scherpe rendering: schaal het canvas met `devicePixelRatio`. Respecteer `prefers-reduced-motion`.

### Interactie
- Sleep van een eiland naar een ander eiland om een brug te leggen. Nog eens slepen = dubbele brug, derde keer = weg.
- Alternatief: tik op een eiland, daarna op een buureiland.
- Tik op een bestaande brug: 1 → 2 → 0.
- Toon tijdens het slepen een voorvertoning van de brug; ongeldige doelen worden niet gemarkeerd.
- Ruime aanraakzones op mobiel (min. 44 px). Werkt met muis, touch en toetsenbord (pijltjes + spatie) voor toegankelijkheid.
- Optionele geluidjes (standaard aan, met duidelijke mute-knop), klein en gegenereerd of met open licentie.

---

## 6. Advertenties, privacy en juridisch

- Advertenties (Google AdSense of alternatief) via een `AdSlot`-component met **vooraf gereserveerde hoogte** (geen layout shift).
- Nooit advertenties over of in het speelveld. Plaatsing: onder het speelveld en in het resultaatscherm. In endless: hoogstens een interstitial om de N levels (configureerbaar), nooit midden in een puzzel.
- Laad advertentiescripts lazy en pas na toestemming.
- Het spel mikt op de EU: gebruik een door Google gecertificeerde CMP (TCF v2.2) voor toestemming. Zonder toestemming: niet-gepersonaliseerde ads of geen ads, volgens de CMP-instellingen.
- Pagina's: privacybeleid, cookiebeleid, "hoe speel je", over. Knop om profiel en data te wissen.
- Gebruik de naam "Bridgle", maar verwijs nergens naar Wordle, NYT of LinkedIn in naam, logo of marketing.

---

## 7. Talen
- Engels als standaard, Nederlands als tweede taal. Alle UI-teksten via een eenvoudig i18n-bestand, geen hardgecodeerde strings.

---

## 8. Werkafspraken
- Schrijf eerst de kernlogica in `packages/core`, volledig los van de DOM, met tests.
- Kleine, gerichte commits met duidelijke berichten.
- Stel een voorstel voor en wacht op akkoord bij: nieuwe dependencies, wijzigingen aan het datamodel of API-contract, en alles wat kosten kan veroorzaken.
- Geen secrets in de repo. Gebruik `wrangler secret` en GitHub Secrets.
- Houd een `README.md` bij met lokaal opstarten, testen en deployen.
- Als iets onduidelijk is aan de speelregels of de twist, vraag het in plaats van te gokken.

---

## 9. Mijlpalen

1. **Core**: datamodel, seeded RNG, regelvalidatie (incl. riffen), logische solver, backtracking-uniciteitscheck, generator, moeilijkheidsscore. Tests + benchmark.
2. **Speelbaar prototype**: canvas renderer (eerst eenvoudig), interactie, win-detectie, undo/reset. Endless mode lokaal via Web Worker.
3. **Daily mode lokaal**: datum → puzzelnummer, lokale stats en streaks in IndexedDB, deelbaar resultaat, aftelklok.
4. **Backend**: Worker + D1, migraties, endpoints, anoniem profiel, herstelcode, sync van resultaten, daily-generatiescript + GitHub Action.
5. **Visuele afwerking**: cartoonstijl eilanden en bruggen, animaties, winstanimatie, dark mode, geluid, reduced motion, toegankelijkheid.
6. **PWA en performance**: service worker, offline endless, bundlebudget controleren, Lighthouse ≥ 90 op mobiel.
7. **Monetisatie en lancering**: AdSlot, CMP, juridische pagina's, i18n NL/EN, deploy naar Cloudflare Pages + Workers, eigen domein.
