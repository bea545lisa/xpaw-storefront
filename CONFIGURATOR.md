# Generischer Canvas-Farbkonfigurator

Ermöglicht Produkten mit vielen Farbvarianten eine Live-Vorschau per Canvas-Compositing, statt für jede Farbkombination ein eigenes Foto zu benötigen. Komplett datengetrieben über Produkt-Metafields — für ein neues Produkt ist **kein Code nötig**, nur Metafield-Werte im Shopify-Admin.

> Der bestehende **Geschirr-Konfigurator** (`assets/geschirr-configurator.js`, `snippets/geschirr-configurator-*.liquid`) ist davon komplett unabhängig und bleibt unverändert bestehen. Dieses generische System ist eine separate, parallele Implementierung (`assets/configurator.js`, `snippets/configurator-*.liquid`) für zukünftige Produkte.

## Damit ein Produkt überhaupt als Konfigurator erkannt wird

Am Produkt **zwei Metafields** setzen, sonst passiert nichts (oder das Falsche):

1. **`custom.canvas_configurator`** → `true` — schaltet die Canvas-Vorschau grundsätzlich frei
2. **`custom.canvas_engine`** → Text `generic` — ohne dieses Feld greift stattdessen der alte, Geschirr-spezifische Pfad (falsche Masken-Namen/Ebenen für jedes andere Produkt)

Erst danach lohnt sich `custom.canvas_layers` & Co. weiter unten zu befüllen.

## Funktionsweise

1. `product.metafields.custom.canvas_configurator` (Boolean) schaltet für ein Produkt die Canvas-Vorschau statt der normalen Bildergalerie frei.
2. `product.metafields.custom.canvas_layers` (JSON) beschreibt **alle** Ebenen, ihre Farboptionen und wie sie sich zueinander verhalten (Zeichenreihenfolge, Umriss, Shading-Aussparung, Metallic-Effekt).
3. `snippets/configurator-preview.liquid` reicht diese Config als JSON an `assets/configurator.js` weiter.
4. `assets/configurator.js` baut daraus zur Laufzeit: die `<canvas>`-Ebenen, lädt die Masken-Bilder, und erzeugt die Farbauswahl-Fieldsets (Swatches) inkl. der versteckten Cart-Line-Item-Properties — alles automatisch aus der Config, ohne Produkt-spezifisches HTML.
5. Beim Ändern einer Farbe malt `configurator.js` nur die betroffene Ebene neu (per `destination-in`-Maskierung), setzt die Cart-Property und aktualisiert die Legend-Anzeige.
6. Dieselbe scroll-gebundene Sticky-Preview wie bei normalen Produkten (`assets/sticky-preview.js`) ist eingebaut — das Vorschaubild bleibt beim Scrollen durch die Optionen sichtbar.

## Wo müssen die Bilder hochgeladen werden?

**Nicht** in die Theme-Assets (das würde einen Code-Deploy pro Produkt erfordern, so wie es beim alten Geschirr-Konfigurator noch gemacht wird — siehe `assets/geschirr-mask-*.png`). Zwei Wege:

**Direkt in rexpaw-admin (empfohlen):** Produktseite → Metafields-Karte → "Wie richte ich Konfigurator ein?" aufklappen → dort bei Schritt 2 Datei auswählen, Namen anpassen, hochladen. Landet als eigenständige Shopify-Datei (nicht in der Produkt-Bildergalerie), URL zum Kopieren erscheint direkt danach. Lädt die Originaldatei unverändert hoch, keine automatische Verkleinerung/Kompression (wichtig für scharfe Maskenkanten).

**Alternativ direkt in Shopify:**
1. Shopify-Admin → **Einstellungen → Dateien** (oder direkt beim Produkt über "Datei hochladen")
2. Bild hochladen
3. Die resultierende URL kopieren (in der Dateiliste auf die Datei klicken, dort die URL kopieren)

Danach die URL in das jeweilige Feld der `canvas_layers`-JSON eintragen (siehe unten) bzw. bei `custom.canvas_shading` / `custom.canvas_background`.

**Format je nach Zweck:**
- **Masken & Shading-Overlay** → **PNG** mit Alpha-Transparenz. Bei Masken: transparent an allen Stellen, die NICHT zur jeweiligen Ebene gehören — die Maske bestimmt per `destination-in`-Compositing, welcher Bereich der Füllfarbe sichtbar bleibt. JPG hat keine Transparenz und funktioniert hier nicht.
- **Hintergrundgrafik** (`custom.canvas_background`) → **JPG** ist hier die bessere Wahl. Die unterste Ebene ist ohnehin komplett deckend (kein Alpha nötig), JPG komprimiert foto-artige Verläufe/Schatten deutlich kleiner als PNG, ohne sichtbaren Qualitätsverlust.

Masken-Bilder sollten quadratisch sein (Referenzgröße im Code: 1000×1000px).

**Namenskonvention** (nicht technisch erzwungen — Shopify Files hat keine echten Unterordner, nur eine durchsuchbare Liste, die produktübergreifend schnell unübersichtlich wird): `canvas-<produkt-handle>-<zweck>.png`, z. B. für einen Napf:

- `canvas-napf-hintergrund-hell.png` / `canvas-napf-hintergrund-dunkel.png` — für `custom.canvas_background`
- `canvas-napf-mask-koerper.png` — Maske pro Ebene, ein Bild je `key` aus `canvas_layers`
- `canvas-napf-shading.png` — für `custom.canvas_shading`

Der Dateiname selbst hat keine Bedeutung für den Code (nur die URL zählt) — das `canvas-`-Präfix macht alle Dateien dieses Systems in der Shopify-Dateiliste per Suche/Sortierung auf einen Blick auffindbar, das Produkt-Handle danach trennt sie zusätzlich pro Produkt.

Masken-Bilder: Form **voll deckend** (Alpha 100%, Farbe selbst egal — Weiß ist nur Konvention, gut sichtbar beim Bearbeiten), außerhalb der Form **komplett transparent** (Alpha 0). Genutzt wird nur der Alpha-Kanal (`destination-in`-Compositing).

### Shading-Overlay erstellen (Photoshop)

`custom.canvas_shading` wird im Code per **Multiply**-Blendmodus (plus leichter Aufhellung, `brightness(1.18)`) über alle Ebenen gelegt. Multiply kann nur **abdunkeln**, nie aufhellen — deshalb ist die Grundregel: **Weiß = keine Wirkung, Grau/Schwarz = Schatten**.

Genau wie beim bestehenden Geschirr-Konfigurator (`assets/geschirr-shading.png`) wird das **nicht von Hand gemalt**, sondern aus einem echten Produktfoto abgeleitet — die natürliche Fotostruktur (Nähte, Falten, Kanten, Schattenwurf) liefert automatisch ein realistischeres Ergebnis als gemalte Schatten:

1. **Produktfoto** verwenden (neutral/diffus beleuchtet ist besser als ein Foto mit hartem Blitzlicht/Reflexionen).
2. Bild → Korrekturen → **Entsättigen** (oder eine Schwarzweiß-Anpassungsebene) — die Farbe raus, nur die Helligkeitsstruktur bleibt übrig.
3. Mit **Gradationskurven** bzw. **Tonwertkorrektur** die Mitteltöne/Lichter Richtung Weiß anheben, bis die Fläche insgesamt fast weiß ist und nur die tatsächlichen Schatten aus dem Foto (Nähte, Falten, Kanten, Unterseiten) als sichtbares Grau/Dunkel übrig bleiben.
4. Mit der ohnehin vorhandenen **Produkt-Maske** freistellen (Auswahl aus der Maske laden, Ebenenmaske anwenden), sodass außerhalb der Produktform Transparenz entsteht.
5. Als **PNG mit Transparenz** exportieren: außerhalb der Produktform muss es transparent sein, sonst wird beim Multiply auch der Hintergrund mit abgedunkelt.

## Metafield-Übersicht

| Metafield | Owner | Typ | Zweck |
|---|---|---|---|
| `custom.canvas_configurator` | Produkt | Boolean | Schaltet die Canvas-Vorschau für dieses Produkt frei |
| `custom.canvas_layers` | Produkt | JSON | Die komplette Ebenen-/Farb-Konfiguration (siehe Schema unten) |
| `custom.canvas_shading` | Produkt | Einzeiliger Text | URL zu einem optionalen Shading-/Struktur-Overlay-Bild (Licht-/Materialwirkung über allen Ebenen) |
| `custom.canvas_outline_scale` | Produkt | Dezimalzahl | Optionale Skalierung des weichen Umriss-Schattens (Standard: `1.035`, meist nicht nötig anzupassen) |
| `custom.canvas_background` | Produkt | JSON | Optionale eigene Hintergrundgrafik (z. B. Boden-/Tischfläche mit Schatten) als unterste, nicht einfärbbare Ebene. Format `{"light":"URL","dark":"URL"}`, wechselt automatisch mit dem Hell/Dunkel-Toggle. **Darf das eigentliche Produkt nicht enthalten**, wenn dessen Farbe wählbar sein soll — das gehört in eine separate Maske unter `canvas_layers` |
| `custom.use_canvas` | Variante | Boolean | Pro Variante: Canvas-Vorschau nutzen statt eines hochgeladenen Bilds (aktuell nur vorbereitet, noch nicht ausgewertet) |

## Schema von `custom.canvas_layers`

Ein Array, ein Eintrag pro Ebene:

```json
[
  {
    "key": "gurt",
    "property": "Gurtband Farbe",
    "mask": "https://cdn.shopify.com/.../mask-gurt.png",
    "outline": true,
    "shadingCutout": false,
    "metallic": false,
    "options": [
      { "name": "Weiss", "hex": "#FFFFFF", "title": "Weiß" },
      { "name": "Pink", "hex": "#F06EB0", "default": true },
      { "name": "Camo Grau", "pattern": "https://cdn.shopify.com/.../muster-camo-grau.jpg", "scale": 0.5 }
    ]
  }
]
```

**Pro Ebene:**
- `key` (Pflicht) — interne ID, muss eindeutig sein, wird als `data-layer`-Attribut verwendet
- `property` (optional) — Anzeigename/Legend-Text. **Weglassen**, wenn die Ebene nicht vom Kunden wählbar sein soll (z. B. ein fixes Label/Logo), dann wird kein Fieldset dafür erzeugt, die Ebene aber trotzdem gerendert
- `mask` (Pflicht, falls die Ebene sichtbar sein soll) — URL zum Masken-Bild (siehe oben)
- `outline` (optional, Standard `false`) — ob diese Ebene zum weichen Umriss-Schatten beiträgt
- `shadingCutout` (optional, Standard `false`) — ob diese Ebene aus dem Shading-Overlay ausgespart wird (z. B. für metallische/glänzende Teile, die kein zusätzliches Multiply-Shading vertragen)
- `metallic` (optional, Standard `false`) — ob die Füllung als metallischer Ring-Glanz-Effekt statt flacher Farbe gerendert wird (feste Ring-Positionen im Code, für andere Formen ggf. nicht passend)

**Pro Option** (Farbwahl innerhalb einer Ebene):
- `name` (Pflicht) — interner Wert, erscheint auch als Cart-Property-Wert
- `hex` **oder** `pattern` (genau eins von beiden) — Flachfarbe als Hex-Code, oder URL zu einem Muster-Bild (wird als wiederholtes Pattern gefüllt)
- `scale` (optional, nur bei `pattern`) — Skalierungsfaktor für die Musterkachel
- `title` (optional) — abweichender Anzeigetext für Tooltip/Screenreader, falls `name` nicht sprechend genug ist
- `default` (optional) — genau eine Option pro Ebene sollte das haben, sonst wird die erste in der Liste verwendet

Die Zeichenreihenfolge der Ebenen (unten drüber) entspricht der Reihenfolge im Array.

## Neues Produkt einrichten — Checkliste

1. Masken-Bilder (eins pro Ebene, nur die jeweilige Silhouette, Rest transparent) und optional ein Shading-Overlay sowie Hintergrundgrafiken (hell/dunkel, **ohne** das Produkt selbst drauf) in **Einstellungen → Dateien** hochladen, URLs notieren
2. Am Produkt: `custom.canvas_configurator` auf `true` setzen, `custom.canvas_engine` auf `generic` setzen (sonst greift der Geschirr-spezifische Pfad)
3. Am Produkt: `custom.canvas_layers` mit der JSON-Konfiguration befüllen (siehe Schema oben)
4. Optional: `custom.canvas_shading`, `custom.canvas_background` und `custom.canvas_outline_scale` setzen
5. Live-Vorschau auf der Produktseite prüfen — bei fehlerhafter/fehlender `canvas_layers`-Konfiguration bleibt die Vorschau einfach leer, es gibt keinen Fehler auf der Seite

## Geplant: Lagerware mit Artikelnummer (`canvas_engine: "generic-stocked"`)

**Noch nicht umgesetzt** — Plan, festgehalten am 30.08.2026 für eine spätere Session.

**Problem heute:** `custom.canvas_engine: "generic"` malt Farben rein kosmetisch — die Radiobuttons kommen komplett aus `canvas_layers`, unabhängig von Shopify-Varianten. Passt für made-to-order-Produkte (wie den Geschirr-Konfigurator: viele Kombinationen, keine eigene Artikelnummer pro Kombi), aber nicht für Lagerware mit begrenzter Farbanzahl, bei der jede Farbe eine eigene Artikelnummer/eigenen Lagerbestand braucht (z. B. Napf).

**Zwei Konfigurator-Betriebsarten, ein Codepfad:**
- `custom.canvas_engine: "generic"` (heutiges Verhalten, unverändert) — made-to-order, keine Varianten-Kopplung, viele Kombinationen möglich, kein SKU pro Kombination.
- `custom.canvas_engine: "generic-stocked"` (neu) — Farbe ist eine echte Shopify-Produktoption mit eigener Variante/SKU/Lagerbestand. Gleiche `canvas_layers`-JSON-Struktur, gleiche Mal-Logik — nur die *Quelle* der aktuellen Auswahl ändert sich.

**Umsetzungsidee:**
1. Merchant legt die Farbe als normale Shopify-Produktoption an (z. B. Option "Farbe" mit Werten "Hellblau", "Rosa", "Grün"), pro Wert eine Variante mit eigenem SKU/Lager.
2. In `canvas_layers` bekommt die entsprechende Ebene pro Option ein `name`, das **exakt** dem Shopify-Options-Wert entspricht (z. B. `"name": "Hellblau"`).
3. Im `generic-stocked`-Modus baut `configurator.js` **keine eigenen Radiobuttons** für diese Ebene, sondern hört auf den nativen `variant-selects`-Change (den Dawn bereits für die echte Variantenwahl rendert).
4. Bei jedem Variantenwechsel: gewählten Options-Wert nehmen, in `canvas_layers` die Option mit passendem `name` suchen, Ebene wie gehabt neu malen (`paintLayer`/`applyOption`, unverändert).
5. Preis/SKU/Lageranzeige laufen dadurch automatisch über den normalen Shopify-Variantenmechanismus — keine Sonderlogik nötig, nur die Verknüpfung "Options-Wert → passende `canvas_layers`-Option" ist neu.

**Was unverändert bleibt:** `geschirr-configurator.js` (alter, handgebauter Konfigurator) braucht diese Unterscheidung nie und bleibt komplett unangetastet — made-to-order ist dort der einzige Anwendungsfall.

## Bekannte Grenzen

- Die Positionen für den Metallic-Ring-Glanz-Effekt (`metallic: true`) sind im Code fest hinterlegt (`RING_SPOTS` in `assets/configurator.js`) — kalibriert für eine geschirr-ähnliche Silhouette. Ein Produkt mit stark abweichender Form bräuchte hierfür eine Code-Anpassung.
- `custom.use_canvas` (Varianten-Flag) ist als Metafield-Definition angelegt, wird aber aktuell noch nicht ausgewertet — die Weiche "Canvas vs. hochgeladenes Bild pro Variante" ist vorbereitet, aber noch nicht verdrahtet.
- Der Export-Button (PNG-Download, beim Geschirr-Konfigurator vorhanden) ist in der generischen Version noch nicht angebunden — `window.configuratorBuildComposite()` liefert das fertige Composite-Canvas, eine UI dafür fehlt noch.
