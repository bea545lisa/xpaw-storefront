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

  function init() {
    const canvases = {};
    document.querySelectorAll('.geschirr-configurator__layer').forEach((canvas) => {
      canvases[canvas.dataset.layer] = canvas;
    });

    if (Object.keys(canvases).length === 0) return;

    const maskImages = {};
    const maskEls = document.querySelectorAll('.geschirr-configurator__mask-source');
    const loadPromises = Array.from(maskEls).map((img) => {
      return loadImage(img.src).then((loaded) => {
        maskImages[img.dataset.mask] = loaded;
      });
    });

    const shadingSourceEl = document.querySelector('.geschirr-configurator__shading-source');
    const shadingCanvas = document.querySelector('.geschirr-configurator__shading');
    if (shadingSourceEl && shadingCanvas) {
      loadPromises.push(loadImage(shadingSourceEl.src).then((loaded) => {
        maskImages.__shadingSource = loaded;
      }));
    }

    const labelSourceEl = document.querySelector('.geschirr-configurator__label-source');
    if (labelSourceEl) {
      loadPromises.push(loadImage(labelSourceEl.src).then((loaded) => {
        maskImages.__labelSource = loaded;
      }));
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

    // Approximate ring centers/radii within the 1000x1000 canvas (neck ring, belly ring).
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
      } else if (layer === 'metal') {
        metallicFill(ctx, canvas, fill);
      } else {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'source-over';
    }

    function scaleTile(img, scale) {
      const tile = document.createElement('canvas');
      tile.width = Math.max(1, Math.round(img.width * scale));
      tile.height = Math.max(1, Math.round(img.height * scale));
      const tctx = tile.getContext('2d');
      tctx.drawImage(img, 0, 0, tile.width, tile.height);
      return tile;
    }

    function applyInput(layer, input) {
      if (input.dataset.pattern) {
        loadImage(input.dataset.pattern).then((img) => {
          const scale = parseFloat(input.dataset.patternScale);
          const tile = scale ? scaleTile(img, scale) : img;
          paintLayer(layer, tile, true);
        });
      } else {
        paintLayer(layer, input.dataset.color, false);
      }
    }

    const outlineCanvas = document.querySelector('.geschirr-configurator__outline');

    function paintOutline() {
      if (!outlineCanvas) return;
      const ctx = outlineCanvas.getContext('2d');
      ctx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);

      const scale = 1.035;
      const w = outlineCanvas.width * scale;
      const h = outlineCanvas.height * scale;
      const x = (outlineCanvas.width - w) / 2;
      const y = (outlineCanvas.height - h) / 2;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ['polsterung', 'gurt', 'schnallen', 'metal'].forEach((layer) => {
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
      if (!shadingCanvas || !maskImages.__shadingSource) return;
      const ctx = shadingCanvas.getContext('2d');
      ctx.clearRect(0, 0, shadingCanvas.width, shadingCanvas.height);

      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(maskImages.__shadingSource, 0, 0, shadingCanvas.width, shadingCanvas.height);

      ctx.globalCompositeOperation = 'destination-out';
      ['metal', 'label'].forEach((layer) => {
        if (maskImages[layer]) {
          ctx.drawImage(maskImages[layer], 0, 0, shadingCanvas.width, shadingCanvas.height);
        }
      });

      ctx.globalCompositeOperation = 'source-over';
    }

    function paintLabel() {
      const canvas = canvases.label;
      const mask = maskImages.label;
      if (!canvas || !mask) return;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';

      if (maskImages.__labelSource) {
        ctx.drawImage(maskImages.__labelSource, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#D9BFA0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    Promise.all(loadPromises).then(() => {
      paintShading();
      paintOutline();
      paintLabel();
      document.querySelectorAll('fieldset[data-layer]').forEach((fieldset) => {
        const layer = fieldset.dataset.layer;
        const checked = fieldset.querySelector('input:checked');
        if (checked) applyInput(layer, checked);
      });
    });

    function buildCompositeCanvas(transparent) {
      const size = 1000;
      const out = document.createElement('canvas');
      out.width = size;
      out.height = size;
      const octx = out.getContext('2d');

      if (!transparent) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
          const bgGrad = octx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
          bgGrad.addColorStop(0, '#3a3a3a');
          bgGrad.addColorStop(0.7, '#202020');
          bgGrad.addColorStop(1, '#121212');
          octx.fillStyle = bgGrad;
        } else {
          octx.fillStyle = '#ffffff';
        }
        octx.fillRect(0, 0, size, size);

        if (outlineCanvas) {
          octx.filter = 'blur(9px)';
          octx.drawImage(outlineCanvas, 0, 0, size, size);
          octx.filter = 'none';
        }
      }

      ['polsterung', 'gurt', 'schnallen', 'metal', 'label'].forEach((layer) => {
        if (canvases[layer]) octx.drawImage(canvases[layer], 0, 0, size, size);
      });

      if (shadingCanvas) {
        octx.filter = 'brightness(1.18)';
        octx.globalCompositeOperation = 'multiply';
        octx.drawImage(shadingCanvas, 0, 0, size, size);
        octx.globalCompositeOperation = 'source-over';
        octx.filter = 'none';
      }

      return out;
    }

    const exportIcon = document.querySelector('.geschirr-configurator__export-icon');
    const exportMenu = document.querySelector('.geschirr-configurator__export-menu');
    if (exportIcon && exportMenu) {
      function openMenu() {
        exportMenu.hidden = false;
        // Force a reflow so the browser registers the display change before
        // the opacity transition starts, otherwise it just pops in instantly.
        void exportMenu.offsetHeight;
        exportMenu.classList.add('geschirr-configurator__export-menu--visible');
      }
      function closeMenu() {
        exportMenu.classList.remove('geschirr-configurator__export-menu--visible');
        window.setTimeout(() => {
          exportMenu.hidden = true;
        }, 200);
      }
      exportIcon.addEventListener('click', (event) => {
        event.stopPropagation();
        if (exportMenu.hidden) openMenu();
        else closeMenu();
      });
      document.addEventListener('click', (event) => {
        if (!exportMenu.hidden && !exportMenu.contains(event.target) && event.target !== exportIcon) {
          closeMenu();
        }
      });
      exportMenu.querySelectorAll('.geschirr-configurator__export-button').forEach((btn) => {
        btn.addEventListener('click', closeMenu);
      });
    }

    // Move the export-row icon to sit right next to the "Share" button
    // instead of floating at the top of the page, above the title. Only
    // reparent the node - never touch the parent's own styles, it's a
    // shared container (also holds the title etc.) and mutating its
    // display/layout broke the whole info column last time.
    const exportRow = document.querySelector('.geschirr-configurator__export-row');
    const shareButton = document.querySelector('.share-button');
    if (exportRow && shareButton && shareButton.parentElement) {
      shareButton.parentElement.insertBefore(exportRow, shareButton.nextSibling);
      shareButton.style.display = 'inline-flex';
      shareButton.style.alignItems = 'center';
      shareButton.style.verticalAlign = 'middle';
      exportRow.style.display = 'inline-flex';
      exportRow.style.verticalAlign = 'middle';
      exportRow.style.marginLeft = '2rem';
    }

    document.querySelectorAll('.geschirr-configurator__export-button').forEach((exportButton) => {
      exportButton.addEventListener('click', () => {
        const transparent = exportButton.dataset.mode === 'transparent';
        const out = buildCompositeCanvas(transparent);
        out.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = transparent ? 'geschirr-vorschau-transparent.png' : 'geschirr-vorschau.png';
          link.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      });
    });

    const preview = document.querySelector('.geschirr-configurator__preview');
    if (preview && typeof window.openZoomOverlaySrc === 'function') {
      preview.classList.add('image-magnify-hover');
      preview.addEventListener('click', () => {
        const out = buildCompositeCanvas(false);
        window.openZoomOverlaySrc(out.toDataURL('image/png'), 2.5);
      });
    }

    document.addEventListener('change', (event) => {
      const input = event.target;
      if (input.tagName !== 'INPUT') return;

      const fieldset = input.closest('fieldset[data-layer]');
      if (!fieldset) return;
      const layer = fieldset.dataset.layer;

      applyInput(layer, input);

      const hidden = document.querySelector(`input[data-hidden-for="${layer}"]`);
      if (hidden) hidden.value = input.value;

      const valueLabel = document.querySelector(`[data-value-for="${layer}"]`);
      if (valueLabel) valueLabel.textContent = input.value;
    });

    initStickyPreview();
  }

  // Now shares the same scroll-linked shrink/collapse/price-mirror system
  // built for normal products (assets/sticky-preview.js +
  // sticky-product-media.js) instead of the configurator's own separate,
  // simpler implementation this used to be (plain CSS-transition width
  // shrink, no title/price fade, its own bespoke price-mirror markup) - see
  // sticky-preview.js for why each of those pieces works the way it does.
  // Unlike a normal product, deliberately not passing a releaseAt/
  // releaseGap here: the whole point of this configurator's sticky preview
  // (long, multi-fieldset options list) is that the image stays attached
  // the entire time you're scrolling through the options, only letting go
  // via native sticky release once the tall shared scope itself runs out -
  // exactly what omitting releaseAt leaves in place (checkRelease() in
  // sticky-preview.js never runs without it).
  function initStickyPreview() {
    const previewWrapper = document.querySelector('.geschirr-configurator__preview-wrapper');
    const sentinel = document.querySelector('.geschirr-configurator__preview-sentinel');
    const options = document.querySelector('.geschirr-configurator__options');
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
    const previewEl = previewWrapper.querySelector('.geschirr-configurator__preview');

    // The wrapper already bleeds to 100vw unconditionally on mobile (see
    // geschirr-configurator.css) rather than only once stuck like a normal
    // product's - so unlike sticky-product-media.js, no styleInterpolations
    // entry is needed for the wrapper's own width/margin-left here, only
    // the zoom icon.
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
      wrapper: '.geschirr-configurator__preview-wrapper',
      sentinel: '.geschirr-configurator__preview-sentinel',
      scopeThrough: scopeThroughEl,
      shrinkTarget: previewEl,
      shrinkFrom: 94,
      shrinkTo: 54,
      // 90 (the normal-product value) was deliberately kept short there to
      // avoid overlapping with the releaseAt push-back timing - not a
      // concern here, this configurator never sets releaseAt at all. A
      // taller square preview (vs. a normal product's flatter gallery)
      // means the same 90px collapsed eyebrow/title/price so abruptly that
      // the "Gurtfarbe" options legend right below them was nearly covered
      // by the time it finished. More scroll distance to spread the same
      // fade over.
      shrinkDistance: 180,
      // The default (0.7, last 30%) concentrates the title/price height
      // collapse into a short window - fine for a normal product's smaller
      // title/price block, but this configurator's larger price--large +
      // bigger heading collapsing that much height in that short a window
      // made the page visibly speed up if you were still actively
      // scrolling right when it happened. Starting earlier (last 70% of
      // 180px = 126px instead of 54px) spreads the same height change over
      // more distance - kept above 0 rather than the whole range, so
      // height still only starts moving once opacity has faded
      // meaningfully (avoids the original "sliding into the mirror"
      // overlap issue that the 0.7 default was chosen to prevent).
      collapseStartProgress: 0.3,
      // Spreading shrinkDistance to 180 for the height-collapse fix above
      // also stretched the opacity fade (which runs across the whole
      // distance by default) out just as much, reading as too slow. Fading
      // fully out by the 40% mark (72px) keeps the fade itself brisk while
      // still leaving the later, larger shrinkDistance for the height
      // collapse and shrink.
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
