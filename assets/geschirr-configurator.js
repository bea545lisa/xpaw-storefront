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
      exportIcon.addEventListener('click', (event) => {
        event.stopPropagation();
        exportMenu.hidden = !exportMenu.hidden;
      });
      document.addEventListener('click', (event) => {
        if (!exportMenu.hidden && !exportMenu.contains(event.target) && event.target !== exportIcon) {
          exportMenu.hidden = true;
        }
      });
      exportMenu.querySelectorAll('.geschirr-configurator__export-button').forEach((btn) => {
        btn.addEventListener('click', () => {
          exportMenu.hidden = true;
        });
      });
    }

    // Move the export-row icon to sit right next to the "Share" button
    // instead of floating at the top of the page, above the title.
    const exportRow = document.querySelector('.geschirr-configurator__export-row');
    const shareButton = document.querySelector('.share-button');
    if (exportRow && shareButton && shareButton.parentElement) {
      shareButton.parentElement.insertBefore(exportRow, shareButton.nextSibling);
      shareButton.parentElement.style.display = 'flex';
      shareButton.parentElement.style.alignItems = 'center';
      shareButton.parentElement.style.gap = '0.6rem';
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
    initPriceMirror();
  }

  // The real price is up near the product title, out of view once you're
  // scrolled down and the preview has stuck to the top - show a small copy
  // there too so price changes (e.g. picking "Mit Brustring") stay visible.
  function initPriceMirror() {
    const priceEl = document.querySelector('.geschirr-configurator__price-mirror-price');
    const sourceContainer = document.querySelector('[id^="price-"]');
    if (!priceEl || !sourceContainer) return;

    function sync() {
      const current = sourceContainer.querySelector('.price-item--sale') || sourceContainer.querySelector('.price-item--regular');
      priceEl.textContent = current ? current.textContent.trim() : '';
    }

    sync();
    new MutationObserver(sync).observe(sourceContainer, { childList: true, subtree: true, characterData: true });
  }

  // On mobile, move the preview image to sit right above the color options
  // and make it `position: sticky` there. Sticky is native browser behaviour:
  // it sticks while scrolling through that shared container (image + options)
  // and lets go by itself once the container (i.e. the options) scrolls past -
  // no JS position/size math, so it can't drift out of sync with the header.
  function initStickyPreview() {
    const previewWrapper = document.querySelector('.geschirr-configurator__preview-wrapper');
    const sentinel = document.querySelector('.geschirr-configurator__preview-sentinel');
    const options = document.querySelector('.geschirr-configurator__options');
    if (!previewWrapper || !sentinel || !options) return;

    const desktopParent = previewWrapper.parentElement;
    const desktopNextSibling = previewWrapper.nextSibling;
    const sentinelDesktopParent = sentinel.parentElement;
    const sentinelDesktopNextSibling = sentinel.nextSibling;
    const optionsDesktopParent = options.parentElement;
    const optionsDesktopNextSibling = options.nextSibling;
    const mobileQuery = window.matchMedia('(max-width: 749px)');
    let onMobile = null;

    // A dedicated scope that ends exactly where the options end, so the
    // sticky image lets go right there instead of dragging along through
    // the rest of the product info (description etc. below the buy button).
    const scope = document.createElement('div');
    scope.className = 'geschirr-configurator__sticky-scope';

    function apply() {
      const shouldBeMobile = mobileQuery.matches;
      if (shouldBeMobile === onMobile) return;
      onMobile = shouldBeMobile;
      if (shouldBeMobile) {
        optionsDesktopParent.insertBefore(scope, options);
        scope.appendChild(sentinel);
        scope.appendChild(previewWrapper);
        scope.appendChild(options);
      } else {
        sentinelDesktopParent.insertBefore(sentinel, sentinelDesktopNextSibling);
        desktopParent.insertBefore(previewWrapper, desktopNextSibling);
        optionsDesktopParent.insertBefore(options, optionsDesktopNextSibling);
        scope.remove();
      }
    }

    apply();
    mobileQuery.addEventListener('change', apply);

    // The sentinel sits right before the wrapper; once it scrolls out of view
    // the wrapper has hit its sticky "top" offset and is now actually stuck -
    // that's when we shrink it. Position itself stays 100% native `sticky`.
    const stuckObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          previewWrapper.classList.toggle('geschirr-configurator__preview-wrapper--stuck', !entry.isIntersecting);
        });
      },
      // A small rootMargin buffer so the shrink-triggered height change can't
      // itself nudge the sentinel back across the exact toggle line.
      { threshold: 0, rootMargin: '40px 0px 0px 0px' }
    );
    stuckObserver.observe(sentinel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
