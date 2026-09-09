# SparBox Manager

Ein privater Finanzmanager als statische Webanwendung – kein Login, keine Cloud, keine schweren Frameworks. Läuft vollständig im Browser.

**🌐 Live:** [sparbox-manager.vercel.app](https://sparbox-manager.vercel.app/)

> **Geplante Hardware:** Raspberry Pi Zero 2 W mit motorgesteuertem Schloss. Die Hardwareanbindung folgt in einer späteren Phase; bis dahin ist die Box-Öffnung als deutlich gekennzeichnete **Simulation** ausgeführt.

---

## ✨ Funktionen

### SparBox
| Funktion | Beschreibung |
|---|---|
| 💰 Einzahlung & Auszahlung | Betrag, Notiz, Schnellauswahl (1–50 €) |
| 📊 Kontostand | Automatisch aus allen Buchungen berechnet |
| 🎯 Sparziel | Name, Zielbetrag, Zieldatum |
| 📈 Fortschritt | Prozentring, Meilensteine 25/50/75/100 % |
| 🔐 Sechsstelliger PIN | Schutz der simulierten Box-Öffnung |
| 📄 PDF-Kontoauszug | Alle Buchungen, lokal erzeugt |

### Strafen-Modul
- Strafen, Forderungen und Ratenzahlungen verwalten
- Bezeichnung, Gläubiger, Aktenzeichen, Gesamtbetrag, Rate, Fälligkeit, Status
- Zahlungen erfassen → Restbetrag wird automatisch neu berechnet
- Automatisch auf „Bezahlt" setzen, wenn Restbetrag = 0
- Zahlungsverlauf pro Strafe anzeigen
- Fortschrittsbalken je Strafe
- Überfällige Raten optisch hervorgehoben
- Suche, Filter nach Status, Sortierung nach Fälligkeit / Restbetrag / Name
- Zusammenfassung: Gesamtforderung, bezahlt, offen, monatliche Raten, überfällig
- Strafenübersicht als PDF

### Ausgaben-Modul
- Regelmäßige und einmalige Ausgaben (Miete, Strom, Internet, Versicherung, …)
- Kategorie, Betrag, Intervall (Einmalig / Wöchentlich / Monatlich / Vierteljährlich / Jährlich)
- Nächste Fälligkeit, Zahlungsmethode, Notiz
- Als bezahlt markieren, pausieren, aktivieren, löschen
- Monatsumrechnung für vierteljährliche und jährliche Ausgaben
- Zusammenfassung: monatliche Gesamtausgaben, bezahlt, offen, nächste Fälligkeit, Kategorienverteilung
- Ausgaben als PDF

### Übersicht (Finanzüberblick)
Kompakter Bereich mit: SparBox-Stand, offene Forderungen, monatliche Strafraten, monatliche Ausgaben, nächste Zahlung, Anzahl überfälliger Zahlungen.

---

## ⚠️ Datenspeicherung

Alle Daten werden **ausschließlich lokal im Browser** gespeichert (`localStorage`).

- Jeder Nutzer hat seinen eigenen, unabhängigen Datenstand.
- Keine Synchronisation zwischen Geräten oder Browsern.
- Strafen und Ausgaben sind getrennt von SparBox-Buchungen gespeichert.
- Eine Strafe oder Ausgabe zu erfassen **verändert nicht** den SparBox-Kontostand.

---

## 🚀 Lokaler Start

```bash
python3 -m http.server 8080 --directory dist
```

Dann [http://localhost:8080](http://localhost:8080) öffnen. Kein Build-Schritt nötig.

**Test-PIN:** `258014`

---

## 🌐 Veröffentlichung über Vercel

### Import in Vercel

1. Auf [vercel.com](https://vercel.com) einloggen (kostenloser Account reicht)
2. **„Add New Project"** → **„Import Git Repository"**
3. Das Repository `SirajWS/sparbox-manager` auswählen
4. Einstellungen:
   - **Framework Preset:** `Other`
   - **Root Directory:** *(leer lassen – Standardwert)*
   - **Output Directory:** `dist` *(wird aus `vercel.json` automatisch gelesen)*
   - **Build Command:** *(leer lassen)*
   - **Install Command:** *(leer lassen)*
5. **„Deploy"** klicken

Vercel liest `vercel.json` automatisch. Nach dem ersten Deploy erscheint ein öffentlicher Link (z. B. `sparbox-manager-xyz.vercel.app`). Bei jedem Push auf `main` wird automatisch neu deployt.

> **Hinweis:** Die `vercel.json` ist so konfiguriert, dass alle Routen auf `dist/index.html` zeigen – direkte URL-Aufrufe führen also nicht zu einem 404-Fehler.

---

## 🔧 GitHub Pages (alternativ)

Das Repository enthält auch einen GitHub-Actions-Workflow (`.github/workflows/deploy.yml`), der `dist/` auf GitHub Pages deployt. Aktivieren unter **Settings → Pages → Source: GitHub Actions**.

---

## 📁 Projektstruktur

```
sparbox-manager/
├── dist/
│   ├── index.html      # Einzige HTML-Datei (SPA)
│   ├── styles.css      # Komplettes Stylesheet
│   └── app.js          # Gesamte Anwendungslogik
├── .github/
│   └── workflows/
│       └── deploy.yml  # GitHub Actions → GitHub Pages
├── vercel.json         # Vercel-Konfiguration
├── .gitignore
└── README.md
```

---

## 🔮 Geplante Erweiterungen

- [ ] Raspberry Pi Zero 2 W Hardwareanbindung (GPIO, Motorsteuerung)
- [ ] Geräteübergreifende Datensynchronisation
- [ ] Push-Benachrichtigungen bei Transaktionen

---

*Erstellt von [SirajWS](https://github.com/SirajWS)*
