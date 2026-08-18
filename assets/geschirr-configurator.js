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

    function metallicPattern(ctx, hex) {
      const size = 48;
      const tile = document.createElement('canvas');
      tile.width = size;
      tile.height = size;
      const tctx = tile.getContext('2d');
      const grad = tctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, shadeHex(hex, 130));
      grad.addColorStop(0.22, shadeHex(hex, -25));
      grad.addColorStop(0.45, shadeHex(hex, 95));
      grad.addColorStop(0.7, shadeHex(hex, -65));
      grad.addColorStop(1, shadeHex(hex, 130));
      tctx.fillStyle = grad;
      tctx.fillRect(0, 0, size, size);
      return ctx.createPattern(tile, 'repeat');
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
      } else if (layer === 'metal') {
        ctx.fillStyle = metallicPattern(ctx, fill);
      } else {
        ctx.fillStyle = fill;
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'source-over';
    }

    function applyInput(layer, input) {
      if (input.dataset.pattern) {
        loadImage(input.dataset.pattern).then((tile) => {
          paintLayer(layer, tile, true);
        });
      } else {
        paintLayer(layer, input.dataset.color, false);
      }
    }

    Promise.all(loadPromises).then(() => {
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
