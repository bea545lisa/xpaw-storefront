# XPaw Storefront

Shopify Theme Portfolio-Projekt auf Basis von [Dawn](https://github.com/Shopify/dawn) — entstanden als praktische Vertiefung in Liquid, Theme-Architektur und Shopify-eigene APIs.

## Live-Demo

[xpaw.webwork-oberland.de](https://xpaw.webwork-oberland.de) — Passwort: `demo`

---

## Umgesetzte Beispiele

### 1. Interaktiver Geschirr-Konfigurator
[`snippets/geschirr-configurator-preview.liquid`](snippets/geschirr-configurator-preview.liquid) + [`assets/geschirr-configurator.js`](assets/geschirr-configurator.js)

Live-Vorschau eines konfigurierbaren Hundegeschirrs per Canvas-Compositing aus mehreren Ebenen (Polsterung, Gurtband, Schnallen, Metall-Optionen, Label), inkl. PNG-Export der eigenen Kreation (auch mit transparentem Hintergrund). Bildmasken und Shading-/Struktur-Overlay für realistische Licht-/Materialwirkung selbst in Photoshop erstellt. Nutzt für sein eigenes Sticky-Verhalten dieselbe geteilte Implementierung wie das Sticky-Preview-Feature unten, statt einer separaten Lösung.

### 2. Scroll-gebundenes Sticky-Preview-Feature
[`assets/sticky-preview.js`](assets/sticky-preview.js) + [`assets/sticky-product-media.js`](assets/sticky-product-media.js)

Produktbild bleibt auf Mobile beim Scrollen sichtbar, schrumpft synchron zur Scrollposition (kein CSS-Transition-Timing, direkt an `scrollY` gekoppelt), Titel/Preis blenden weich aus und werden durch eine kompakte Mini-Ansicht ersetzt. Geteilte, wiederverwendbare Implementierung — dieselbe Logik treibt sowohl normale Produktseiten als auch den Konfigurator (siehe oben), parametrisiert über Config-Optionen (`shrinkDistance`, `collapseStartProgress`, `fadeEndProgress`, optionales `releaseAt` für vorzeitiges Loslassen).

### 3. Bild-Zoom mit Touch-/Maus-Unterscheidung
[`assets/magnify.js`](assets/magnify.js)

Vollbild-Zoom-Overlay für Produktbilder, mit unterschiedlicher Zoom-Stärke je nach Gerät und robustem Konflikt-Handling gegenüber Dawns eigenem Modal-Opener (Capture-Phase-Klick-Interception, die nur eingreift, wenn tatsächlich eine nutzbare Bildquelle ermittelt werden kann — verhindert, dass andere Klick-Handler auf demselben Element, wie beim Konfigurator, blockiert werden).

### 4. Custom Section mit Schema
[`sections/campaign-banner.liquid`](sections/campaign-banner.liquid)

Eigene Kampagnen-Banner-Section mit vollständigem Theme-Editor-Schema (Bild, Overlay-Opacity, Text, Button, Farbschema, Textausrichtung). Vollständig lokalisiert über `t:`-Referenzen, sauber getrennt in:
- [`locales/de.schema.json`](locales/de.schema.json) / [`locales/en.default.schema.json`](locales/en.default.schema.json) — Editor-/Schema-Übersetzungen
- (Storefront-Texte würden in `locales/de.json` / `locales/en.default.json` liegen)

### 5. Performance-Audit
[`PERFORMANCE_NOTES.md`](PERFORMANCE_NOTES.md)

Dokumentierte Code-Analyse zentraler, performance-kritischer Stellen (`snippets/card-product.liquid`, `layout/theme.liquid`) — mit Verifikation, welche Optimierungen (Lazy Loading, responsive Images, LCP-Priorisierung, bedingtes Stylesheet-Laden) bereits korrekt implementiert sind.

### 6. Eigenprogrammierung über Standard-Apps hinaus
[`sections/recently-viewed.liquid`](sections/recently-viewed.liquid) + [`assets/recently-viewed.js`](assets/recently-viewed.js)

"Zuletzt angesehene Produkte"-Feature, komplett ohne App:
- Produktbesuche werden clientseitig in `localStorage` gespeichert
- Anzeige lädt Produktdaten live über Shopifys natives AJAX-Endpoint `/products/{handle}.js`
- Kein Storefront-API-Token, keine Drittanbieter-App nötig

---

## Tech-Stack

- Liquid, JSON-Templates (Online Store 2.0)
- Vanilla JavaScript (Fetch API, Custom Elements aus Dawn, IntersectionObserver, HTML5 Canvas API)
- CSS Custom Properties, Responsive/Mobile-First-Layouts
- Adobe Photoshop (Maskenerstellung, Bildbearbeitung für den Konfigurator)
- Shopify CLI (`theme dev`) für lokale Entwicklung mit Live-Reload
- GitHub Actions für automatisiertes Deployment bei jedem Push, inkl. Sync auf einen zweiten, parallel betriebenen Store

## Lokale Entwicklung

```bash
shopify theme dev --store <dein-dev-store>
```
