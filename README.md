# MixMax Manager

Gemeinsame Finanzverwaltung für das Fastfood-Restaurant MixMax.
Zwei Benutzer – Siraj und Chedi – sehen dasselbe Buch in TND.

**Vercel-Projekt:** [sparbox-manager](https://vercel.com/sirajws-projects/sparbox-manager)

Phase 1 speichert Buchungen dauerhaft in Supabase. Es gibt kein Kassensystem, keine Offline-Warteschlange und kein Rollenmodell.

---

## Was die App kann

- Login mit E-Mail + Passwort (Supabase Auth, keine öffentliche Registrierung)
- Eine gemeinsame Tabelle `bookings` als einzige Quelle der Wahrheit
- Schnellerfassung ohne Speichern-Button (Abschluss per letztem Pflichtfeld / Enter / Blur)
- Übersicht: Einzahlungen, Ausgaben, aktueller Stand, von Siraj/Chedi bezahlte Ausgaben
- Buchungsliste mit Entfernen
- Kontoauszug inkl. einfachem PDF
- Optional Realtime: INSERT/DELETE erscheinen beim anderen Gerät ohne Reload

Alte SparBox-Daten in `localStorage` werden **nicht** importiert und nicht angezeigt.

---

## Lokal starten

1. Node.js 20+ installieren
2. `.env.example` nach `.env` kopieren und Werte eintragen:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

3. Abhängigkeiten und Dev-Server:

```bash
npm install
npm run dev
```

4. Tests:

```bash
npm test
```

Build:

```bash
npm run build
```

---

## Environment Variables

Nur Frontend-Werte, **keine** Service-Role-Keys, **keine** Passwörter.

| Variable | Wo setzen | Bedeutung |
|---|---|---|
| `VITE_SUPABASE_URL` | lokale `.env` und Vercel | Projekt-URL aus Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | lokale `.env` und Vercel | `anon` / `public` Key aus Supabase → Settings → API |

In Vercel: Project → Settings → Environment Variables, für Production (und Preview). Danach neu deployen.

---

## Supabase manuell einrichten

Die App legt das Projekt nicht selbst an.

1. Supabase-Projekt erstellen
2. Authentication → Providers: **Email** aktiv, **Confirm email** nach Bedarf
3. Authentication → Providers: öffentliche Registrierung **deaktivieren** (Disable sign ups)
4. Zwei Benutzer manuell anlegen: Siraj und Chedi (Authentication → Users → Add user)
5. SQL aus [`supabase/schema.sql`](supabase/schema.sql) im SQL Editor ausführen
   - Tabelle `bookings`
   - Constraints, Indexe
   - Trigger für `created_by`
   - Row Level Security
   - Realtime-Publication
6. Realtime: Table `bookings` muss in der Publication `supabase_realtime` stehen (macht das SQL)

Kein Google-Login. Keine Passwörter in Git.

---

## Vercel

1. Repository importieren oder bestehendes Projekt [sparbox-manager](https://vercel.com/sirajws-projects/sparbox-manager) verwenden
2. Framework: Vite (oder Other mit Build `npm run build`, Output `dist`)
3. Variablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen
4. Deploy

`vercel.json` setzt Build-Command, Output-Directory und SPA-Rewrites.

---

## Projektstruktur

```
├── index.html
├── src/
│   ├── main.js
│   ├── styles.css
│   └── lib/          # TND, bookings-Logik, PDF, Supabase-Client
├── supabase/schema.sql
├── .env.example
├── vite.config.js
└── vercel.json
```

---

## Nächste kleine Schritte (nicht Phase 1)

- PDF mehrseitig, wenn sehr viele Buchungen auf eine Seite nicht mehr passen
- Buchung nachträglich bearbeiten (UPDATE ist per RLS schon erlaubt, in der UI noch nicht)
- Filter in der Buchungsliste

---

*Früher SparBox Manager. Alte localStorage-Ledger, Sparziele, Strafen, PIN und Geldfach-Simulation sind entfernt.*
