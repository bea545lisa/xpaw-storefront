# Performance-Audit: card-product.liquid & theme.liquid

Kurzer Audit zentraler, performance-kritischer Stellen im Theme (Aufgabe: Performance-Optimierung).

## Geprüft: `snippets/card-product.liquid`

Wird auf jeder Kollektionsseite mehrfach gerendert (bis zu 20+ mal pro Seite) — daher besonders relevant.

**Bereits korrekt gelöst (kein Handlungsbedarf):**
- `srcset`/`sizes`/`width`/`height` sind für jedes Produktbild gesetzt → kein Layout-Shift, korrekte Bildgröße je Viewport
- `loading="lazy"` ist konfigurierbar über den `lazy_load`-Parameter
- In `sections/main-collection-product-grid.liquid` (Zeile 159-186) werden die ersten 2 Produkte **nicht** lazy geladen (LCP-relevant, above-the-fold), alle weiteren schon — korrektes LCP-Pattern
- Component-Stylesheets (`component-rating.css`, `component-price.css` etc.) werden über `skip_styles` nur beim **ersten** Karten-Rendering pro Seite geladen, nicht bei jeder Wiederholung in der Schleife — verhindert doppelte `<link>`-Tags

## Geprüft: `layout/theme.liquid`, unbedingt geladene Scripts

Scripts wie `cart-disclosure-modal.js` schienen auf den ersten Blick auf den Cart-Drawer (`cart_type: drawer`) einschränkbar — Gegenprobe per `grep` zeigt aber, dass dieselbe Komponente auch auf der Cart-Seite (`main-cart-items.liquid`) und bei der Notification-Variante (`cart-notification-product.liquid`) verwendet wird. Eine Einschränkung auf `cart_type == 'drawer'` hätte diese Fälle kaputt gemacht. Bleibt bewusst unverändert.

## Fazit

Dawn ist als Shopify-Referenz-Theme in den geprüften Bereichen bereits konsequent auf Performance ausgelegt. Der Wert dieser Übung lag darin, das durch Code-Lektüre zu verifizieren statt blind zu "optimieren".
