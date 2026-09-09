# SparBox Manager

Eine responsive Webanwendung zur privaten Verwaltung von Bargeld in einer intelligenten Sparbox. Das Projekt ist als einfache statische Webseite konzipiert – kein Login, keine Cloud, keine schweren Frameworks.

> **Geplante Hardware:** Raspberry Pi Zero 2 W mit motorgesteuertem Schloss. Die Hardwareanbindung folgt in einer späteren Phase; bis dahin ist die Box-Öffnung als deutlich gekennzeichnete **Simulation** ausgeführt.

---

## 🌐 Öffentlicher Link

**[sirajws.github.io/sparbox-manager](https://sirajws.github.io/sparbox-manager/)**

Die Seite wird automatisch über GitHub Actions veröffentlicht, sobald Änderungen auf den `main`-Branch gepusht werden.

---

## ✨ Funktionen

| Funktion | Beschreibung |
|---|---|
| 💰 Einzahlung & Auszahlung | Betrag, Notiz und Schnellauswahl (1–50 €) |
| 📊 Kontostand | Wird automatisch aus allen Buchungen berechnet |
| 🎯 Sparziel | Name, Zielbetrag und Zieldatum frei einstellbar |
| 📈 Fortschritt | Prozentring, Meilensteine (25 / 50 / 75 / 100 %) |
| 🗓️ Monatsrate | Benötigte Rate bis zum Zieldatum |
| 📋 Buchungsverlauf | Vollständige Tabelle mit Kontostand je Buchung |
| 🔍 Suche & Filter | Freitextsuche und Filter nach Ein-/Auszahlung |
| 📄 PDF-Kontoauszug | Lokale Generierung ohne Server (alle Buchungen) |
| 🔐 Sechsstelliger PIN | Schutz der simulierten Box-Öffnung |
| 🔓 Öffnung simulieren | PIN-Dialog mit deutlichem Simulationshinweis |
| 💾 Lokale Speicherung | Daten bleiben im Browser (`localStorage`) |

---

## ⚠️ Datenspeicherung

Die Anwendung speichert alle Daten **ausschließlich lokal im Browser** des jeweiligen Geräts (`localStorage`). Das bedeutet:

- Jeder Nutzer hat seinen eigenen, unabhängigen Datenstand.
- Die Daten werden **nicht** zwischen verschiedenen Geräten oder Browsern synchronisiert.
- Eine Cloud-Synchronisation ist für eine spätere Phase geplant.

---

## 🚀 Lokaler Start

Kein Build-Schritt erforderlich. Einfach einen lokalen HTTP-Server starten:

```bash
python3 -m http.server 8080 --directory dist
```

Dann im Browser öffnen: [http://localhost:8080](http://localhost:8080)

Alternativ mit Node.js (`npx serve dist`) oder dem VS-Code-Plugin **Live Server**.

---

## 🔑 Test-PIN

Der voreingestellte PIN für Tests lautet:

```
258014
```

Der PIN kann unter **Einstellungen → Öffnungs-PIN** jederzeit geändert werden.

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
├── .gitignore
└── README.md
```

---

## 🔧 GitHub Pages aktivieren

Nach dem ersten Push die Pages-Quelle einmalig im Repository einstellen:

1. GitHub → **Settings** → **Pages**
2. **Source:** `GitHub Actions`
3. Speichern – der nächste Push löst die automatische Veröffentlichung aus.

---

## 🛡️ Sicherheit & Datenschutz

- Keine Kontoverbindung, keine echten Bankdaten.
- Alle Daten verbleiben im lokalen Browser des Nutzers.
- Der PIN wird nur lokal gespeichert und schützt die simulierte Box-Öffnung.

---

## 🔮 Geplante Erweiterungen

- [ ] Raspberry Pi Zero 2 W Hardwareanbindung (GPIO, Motorsteuerung)
- [ ] Geräteübergreifende Datensynchronisation
- [ ] Push-Benachrichtigungen bei Transaktionen

---

*Erstellt von [SirajWS](https://github.com/SirajWS)*
