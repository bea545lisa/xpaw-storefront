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
      { x: 500, y: 480, r: 75 },
      { x: 500, y: 900, r: 80 },
    ];

    function paintRingShine(ctx, cx, cy, r, hex) {
      const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grad.addColorStop(0, shadeHex(hex, 170));
      grad.addColorStop(0.35, shadeHex(hex, 40));
      grad.addColorStop(0.6, hex);
      grad.addColorStop(0.85, shadeHex(hex, -70));
      grad.addColorStop(1, shadeHex(hex, -120));

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
      ['metal', 'schnallen'].forEach((layer) => {
        if (maskImages[layer]) {
          ctx.drawImage(maskImages[layer], 0, 0, shadingCanvas.width, shadingCanvas.height);
        }
      });

      ctx.globalCompositeOperation = 'source-over';
    }

    Promise.all(loadPromises).then(() => {
      paintShading();
      paintOutline();
      document.querySelectorAll('fieldset[data-layer]').forEach((fieldset) => {
        const layer = fieldset.dataset.layer;
        const checked = fieldset.querySelector('input:checked');
        if (checked) applyInput(layer, checked);
      });
    });

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
