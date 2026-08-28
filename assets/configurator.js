// Generic, metafield-driven canvas colour configurator - a product-agnostic
// version of assets/geschirr-configurator.js. That file stays exactly as-is
// (it's live and needs to keep working); this is a parallel implementation
// so a *new* product can get its own configurable-colour preview purely
// from data (custom.canvas_layers / custom.canvas_outline_scale product
// metafields), without anyone writing product-specific JS or hand-authored
// swatch markup the way geschirr-configurator.js/geschirr-configurator-
// options.liquid currently require.
//
// Not wired into any live product yet - no second product/metafield data
// exists to validate it against end-to-end. Safe to iterate on freely.
(function () {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function shadeHex(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0xff) + amount;
    let b = (num & 0xff) + amount;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Approximate ring centers/radii within the 1000x1000 canvas, used for the
  // metallic ring-shine effect. Same fixed spots as geschirr-configurator.js
  // - reasonable for any harness-shaped product; a genuinely different shape
  // would need this exposed as config too, not worth guessing at without a
  // second product to calibrate against.
  const RING_SPOTS = [
    { x: 500, y: 480, r: 95 },
    { x: 500, y: 900, r: 100 },
  ];

  function paintRingShine(ctx, cx, cy, r, hex) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, shadeHex(hex, 210));
    grad.addColorStop(0.16, shadeHex(hex, 100));
    grad.addColorStop(0.3, shadeHex(hex, 30));
    grad.addColorStop(0.48, shadeHex(hex, 130));
    grad.addColorStop(0.66, shadeHex(hex, -40));
    grad.addColorStop(0.84, shadeHex(hex, -95));
    grad.addColorStop(1, shadeHex(hex, -140));

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  function metallicFill(ctx, canvas, hex) {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    RING_SPOTS.forEach((spot) => {
      paintRingShine(ctx, spot.x, spot.y, spot.r, hex);
    });
  }

  function scaleTile(img, scale) {
    const tile = document.createElement('canvas');
    tile.width = Math.max(1, Math.round(img.width * scale));
    tile.height = Math.max(1, Math.round(img.height * scale));
    const tctx = tile.getContext('2d');
    tctx.drawImage(img, 0, 0, tile.width, tile.height);
    return tile;
  }

  // config shape (parsed from the element's own JSON <script>):
  // {
  //   layers: [
  //     {
  //       key: "gurt",              // matches canvas/mask/fieldset data-layer
  //       property: "Gurtband Farbe", // cart line item property name + fieldset legend; omit to keep the layer render-only (e.g. a label that isn't user-editable)
  //       mask: "https://.../mask-gurt.png",
  //       outline: true,            // included in the soft drop-shadow outline
  //       shadingCutout: false,     // cut out of the shading/texture overlay
  //       metallic: false,          // use the ring-shine metallic fill instead of flat colour
  //       options: [                // omit entirely for a non-editable layer
  //         { name: "Pink", hex: "#F06EB0", default: true },
  //         { name: "Camo Grau", pattern: "https://.../muster-camo-grau.jpg", scale: 0.5 }
  //       ]
  //     }
  //   ],
  //   shading: "https://.../shading.png",   // optional
  //   outlineScale: 1.035                    // optional, defaults below
  // }
  function initConfigurator() {
    // Document-level, not scoped to a shared wrapper: the preview (media
    // column) and options (info column, inside the buy-buttons form) sit in
    // separate DOM subtrees on a product page, same as geschirr-
    // configurator.js's own document.querySelectorAll usage - there's only
    // ever one configurator on a product page, so no need for a common
    // ancestor to scope against.
    const configEl = document.querySelector('.configurator__config');
    const previewEl = document.querySelector('.configurator__preview');
    const optionsEl = document.querySelector('.configurator__options');
    if (!configEl || !previewEl) return;

    let config;
    try {
      config = JSON.parse(configEl.textContent);
    } catch (e) {
      return;
    }
    if (!Array.isArray(config.layers) || !config.layers.length) return;

    const outlineScale = typeof config.outlineScale === 'number' && !isNaN(config.outlineScale) ? config.outlineScale : 1.035;
    const layerOrder = config.layers.map((layer) => layer.key);
    const outlineLayers = config.layers.filter((layer) => layer.outline).map((layer) => layer.key);
    const shadingCutoutLayers = config.layers.filter((layer) => layer.shadingCutout).map((layer) => layer.key);
    const metallicLayers = new Set(config.layers.filter((layer) => layer.metallic).map((layer) => layer.key));

    // --- Build the canvas stack (outline, one per layer, shading) ---
    const outlineCanvas = document.createElement('canvas');
    outlineCanvas.className = 'configurator__layer-canvas configurator__outline';
    outlineCanvas.width = 1000;
    outlineCanvas.height = 1000;
    previewEl.appendChild(outlineCanvas);

    const canvases = {};
    const maskImages = {};
    const loadPromises = [];

    config.layers.forEach((layer) => {
      const canvas = document.createElement('canvas');
      canvas.className = 'configurator__layer-canvas configurator__layer';
      canvas.dataset.layer = layer.key;
      canvas.width = 1000;
      canvas.height = 1000;
      previewEl.appendChild(canvas);
      canvases[layer.key] = canvas;

      if (layer.mask) {
        loadPromises.push(
          loadImage(layer.mask).then((img) => {
            maskImages[layer.key] = img;
          })
        );
      }
    });

    const shadingCanvas = document.createElement('canvas');
    shadingCanvas.className = 'configurator__layer-canvas configurator__shading';
    shadingCanvas.width = 1000;
    shadingCanvas.height = 1000;
    previewEl.appendChild(shadingCanvas);

    if (config.shading) {
      loadPromises.push(
        loadImage(config.shading).then((img) => {
          maskImages.__shadingSource = img;
        })
      );
    }

    // --- Painting (identical approach to geschirr-configurator.js, just
    //     driven by the config-derived arrays/set above instead of
    //     hard-coded layer-name literals) ---
    function paintLayer(layer, fill, isPattern) {
      const canvas = canvases[layer];
      const mask = maskImages[layer];
      if (!canvas || !mask) return;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'source-over';
      if (isPattern) {
        ctx.fillStyle = ctx.createPattern(fill, 'repeat');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (metallicLayers.has(layer)) {
        metallicFill(ctx, canvas, fill);
      } else {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    function applyOption(layer, option) {
      if (option.pattern) {
        loadImage(option.pattern).then((img) => {
          const tile = option.scale ? scaleTile(img, option.scale) : img;
          paintLayer(layer, tile, true);
        });
      } else if (option.hex) {
        paintLayer(layer, option.hex, false);
      }
    }

    function paintOutline() {
      const ctx = outlineCanvas.getContext('2d');
      ctx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);

      const w = outlineCanvas.width * outlineScale;
      const h = outlineCanvas.height * outlineScale;
      const x = (outlineCanvas.width - w) / 2;
      const y = (outlineCanvas.height - h) / 2;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      outlineLayers.forEach((layer) => {
        if (!maskImages[layer]) return;
        const tmp = document.createElement('canvas');
        tmp.width = outlineCanvas.width;
        tmp.height = outlineCanvas.height;
        const tctx = tmp.getContext('2d');
        tctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(maskImages[layer], 0, 0, tmp.width, tmp.height);
        ctx.drawImage(tmp, x, y, w, h);
      });
    }

    function paintShading() {
      if (!maskImages.__shadingSource) return;
      const ctx = shadingCanvas.getContext('2d');
      ctx.clearRect(0, 0, shadingCanvas.width, shadingCanvas.height);

      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(maskImages.__shadingSource, 0, 0, shadingCanvas.width, shadingCanvas.height);

      ctx.globalCompositeOperation = 'destination-out';
      shadingCutoutLayers.forEach((layer) => {
        if (maskImages[layer]) {
          ctx.drawImage(maskImages[layer], 0, 0, shadingCanvas.width, shadingCanvas.height);
        }
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    // --- Build the option fieldsets/swatches from config, instead of
    //     requiring hand-authored markup per product ---
    const hiddenPropertyInputs = {};
    if (optionsEl) {
      const formId = optionsEl.dataset.formId || '';
      config.layers.forEach((layer) => {
        if (!layer.property || !Array.isArray(layer.options) || !layer.options.length) return;

        const fieldset = document.createElement('fieldset');
        fieldset.dataset.layer = layer.key;
        fieldset.dataset.property = layer.property;

        const defaultOption = layer.options.find((option) => option.default) || layer.options[0];

        const legend = document.createElement('legend');
        legend.textContent = `${layer.property}: `;
        const valueSpan = document.createElement('span');
        valueSpan.className = 'configurator__value';
        valueSpan.dataset.valueFor = layer.key;
        valueSpan.textContent = defaultOption.name;
        legend.appendChild(valueSpan);
        fieldset.appendChild(legend);

        layer.options.forEach((option) => {
          const label = document.createElement('label');
          label.className = 'configurator__swatch';
          if (option.pattern) label.classList.add('configurator__swatch--pattern');
          if (layer.metallic) label.classList.add('configurator__swatch--metallic');
          label.title = option.title || option.name;
          if (option.pattern) {
            label.style.setProperty('--swatch-image', `url('${option.pattern}')`);
          } else {
            label.style.setProperty('--swatch-color', option.hex);
          }

          const input = document.createElement('input');
          input.type = 'radio';
          input.name = layer.key;
          input.value = option.name;
          if (option.pattern) {
            input.dataset.pattern = option.pattern;
            if (option.scale) input.dataset.patternScale = String(option.scale);
          } else {
            input.dataset.color = option.hex;
          }
          if (option === defaultOption) input.checked = true;
          label.appendChild(input);

          const srOnly = document.createElement('span');
          srOnly.className = 'visually-hidden';
          srOnly.textContent = option.title || option.name;
          label.appendChild(srOnly);

          fieldset.appendChild(label);
        });

        optionsEl.appendChild(fieldset);

        // Cart line item property, same pattern as geschirr-configurator-
        // options.liquid's hand-written hidden inputs - kept in sync with
        // the visible legend value via handleChange below.
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = `properties[${layer.property}]`;
        hiddenInput.value = defaultOption.name;
        if (formId) hiddenInput.setAttribute('form', formId);
        optionsEl.appendChild(hiddenInput);
        hiddenPropertyInputs[layer.key] = hiddenInput;
      });
    }

    // --- Wire up option changes ---
    document.addEventListener('change', (event) => {
      const input = event.target;
      if (input.tagName !== 'INPUT') return;
      const fieldset = input.closest('fieldset[data-layer]');
      if (!fieldset) return;
      const layer = fieldset.dataset.layer;
      const layerConfig = config.layers.find((l) => l.key === layer);
      const option = layerConfig && layerConfig.options.find((o) => o.name === input.value);
      if (!option) return;

      applyOption(layer, option);

      const hidden = hiddenPropertyInputs[layer];
      if (hidden) hidden.value = option.name;

      const valueLabel = document.querySelector(`[data-value-for="${layer}"]`);
      if (valueLabel) valueLabel.textContent = option.name;
    });

    // --- Initial paint ---
    Promise.all(loadPromises).then(() => {
      paintShading();
      paintOutline();
      config.layers.forEach((layer) => {
        if (!layer.options || !layer.options.length) return;
        const defaultOption = layer.options.find((option) => option.default) || layer.options[0];
        applyOption(layer.key, defaultOption);
      });
    });

    // --- Export composite (matches geschirr-configurator.js's own
    //     buildCompositeCanvas, minus the studio/transparent background
    //     export UI - can be reattached the same way once a real product
    //     needs it) ---
    function buildCompositeCanvas(transparent) {
      const size = 1000;
      const out = document.createElement('canvas');
      out.width = size;
      out.height = size;
      const octx = out.getContext('2d');

      if (!transparent) {
        octx.fillStyle = '#ffffff';
        octx.fillRect(0, 0, size, size);
        octx.filter = 'blur(9px)';
        octx.drawImage(outlineCanvas, 0, 0, size, size);
        octx.filter = 'none';
      }

      layerOrder.forEach((layer) => {
        if (canvases[layer]) octx.drawImage(canvases[layer], 0, 0, size, size);
      });

      if (config.shading) {
        octx.filter = 'brightness(1.18)';
        octx.globalCompositeOperation = 'multiply';
        octx.drawImage(shadingCanvas, 0, 0, size, size);
        octx.globalCompositeOperation = 'source-over';
        octx.filter = 'none';
      }

      return out;
    }
    // Exposed globally so a future export button (same idea as geschirr-
    // configurator.js's download menu) can call it without this file
    // needing to know about that UI - only one configurator per page.
    window.configuratorBuildComposite = buildCompositeCanvas;
  }

  // Same scroll-linked sticky preview as normal products/the Geschirr
  // configurator (assets/sticky-preview.js), self-contained here instead of
  // a separate glue file like sticky-product-media.js/geschirr-
  // configurator.js's own initStickyPreview - there's only one caller.
  // Deliberately no releaseAt, same reasoning as the Geschirr configurator:
  // this preview should stay stuck through the whole (potentially long)
  // options list, only releasing natively once the shared scope runs out.
  function initStickyBehavior() {
    const previewWrapper = document.querySelector('.configurator__preview-wrapper');
    const sentinel = document.querySelector('.configurator__preview-sentinel');
    const options = document.querySelector('.configurator__options');
    const infoContainer = document.querySelector('.product__info-container');
    const titleH1 = document.querySelector('.product__title h1');
    if (!previewWrapper || !sentinel || !options || !infoContainer || typeof window.initStickyPreview !== 'function') return;

    let scopeThroughEl = null;
    {
      let node = options;
      while (node.parentElement && node.parentElement !== infoContainer) {
        node = node.parentElement;
      }
      if (node.parentElement === infoContainer) scopeThroughEl = node;
    }
    if (!scopeThroughEl) return;

    const eyebrowEl = document.querySelector('.product__info-container .product__text');
    const titleEl = document.querySelector('.product__info-container .product__title');
    const priceEl = document.querySelector('.product__info-container [id^="price-"]');
    const previewEl = previewWrapper.querySelector('.configurator__preview');

    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    const styleInterpolations = [];
    if (previewEl) {
      const zoomIcon = previewEl.querySelector('.product__media-icon');
      if (zoomIcon) {
        styleInterpolations.push(
          { el: zoomIcon, property: 'width', from: 3.6 * remPx, to: 2.6 * remPx, unit: 'px', important: true },
          { el: zoomIcon, property: 'height', from: 3.6 * remPx, to: 2.6 * remPx, unit: 'px', important: true }
        );
      }
    }

    window.initStickyPreview({
      wrapper: '.configurator__preview-wrapper',
      sentinel: '.configurator__preview-sentinel',
      scopeThrough: scopeThroughEl,
      shrinkTarget: previewEl,
      shrinkFrom: 94,
      shrinkTo: 54,
      shrinkDistance: 180,
      collapseStartProgress: 0.3,
      fadeEndProgress: 0.4,
      collapseTargets: [eyebrowEl, titleEl, priceEl],
      styleInterpolations: styleInterpolations,
      priceMirror: {
        priceContainerSelector: '[id^="price-"]',
        title: titleH1 ? titleH1.textContent.trim() : '',
        appendTo: previewWrapper,
      },
    });
  }

  function init() {
    initConfigurator();
    initStickyBehavior();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
