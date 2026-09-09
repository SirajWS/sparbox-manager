# SparBox Manager

Responsive Spar-Management-Webseite für eine geplante intelligente SparBox mit Raspberry Pi Zero 2 W.

## Funktionen

- Einzahlungen und Auszahlungen erfassen
- Sparstand und Sparziel automatisch berechnen
- Zieldatum und monatliche Sparrate
- Buchungsverlauf mit Suche und Filter
- Kontoauszug als PDF
- Sechsstelliger Öffnungs-PIN
- Simulierte Hardware-Freigabe
- Lokale Speicherung im Browser

## Demo

https://sparbox-manager.siraj-workstation.chatgpt.site

## Lokaler Start

```bash
python3 -m http.server 8080 --directory dist
```

Danach `http://localhost:8080` öffnen.

Der voreingestellte Test-PIN lautet `258014`.
