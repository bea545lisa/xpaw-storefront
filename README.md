# RexPaw Storefront

Shopify Theme Portfolio-Projekt auf Basis von [Dawn](https://github.com/Shopify/dawn) — entstanden als praktische Vertiefung in Liquid, Theme-Architektur und Shopify-eigene APIs.

---

## Umgesetzte Beispiele

### 1. Custom Section mit Schema
[`sections/campaign-banner.liquid`](sections/campaign-banner.liquid)

Eigene Kampagnen-Banner-Section mit vollständigem Theme-Editor-Schema (Bild, Overlay-Opacity, Text, Button, Farbschema, Textausrichtung). Vollständig lokalisiert über `t:`-Referenzen, sauber getrennt in:
- [`locales/de.schema.json`](locales/de.schema.json) / [`locales/en.default.schema.json`](locales/en.default.schema.json) — Editor-/Schema-Übersetzungen
- (Storefront-Texte würden in `locales/de.json` / `locales/en.default.json` liegen)

### 2. Performance-Audit
[`PERFORMANCE_NOTES.md`](PERFORMANCE_NOTES.md)

Dokumentierte Code-Analyse zentraler, performance-kritischer Stellen (`snippets/card-product.liquid`, `layout/theme.liquid`) — mit Verifikation, welche Optimierungen (Lazy Loading, responsive Images, LCP-Priorisierung, bedingtes Stylesheet-Laden) bereits korrekt implementiert sind.

### 3. Eigenprogrammierung über Standard-Apps hinaus
[`sections/recently-viewed.liquid`](sections/recently-viewed.liquid) + [`assets/recently-viewed.js`](assets/recently-viewed.js)

"Zuletzt angesehene Produkte"-Feature, komplett ohne App:
- Produktbesuche werden clientseitig in `localStorage` gespeichert
- Anzeige lädt Produktdaten live über Shopifys natives AJAX-Endpoint `/products/{handle}.js`
- Kein Storefront-API-Token, keine Drittanbieter-App nötig

---

## Tech-Stack

- Liquid, JSON-Templates (Online Store 2.0)
- Vanilla JavaScript (Fetch API, Custom Elements aus Dawn)
- Shopify CLI (`theme dev`) für lokale Entwicklung mit Live-Reload

## Lokale Entwicklung

```bash
shopify theme dev --store <dein-dev-store>
```
