(function () {
  const geometries = [
    { type: 'cross', name: 'Cross' },
    { type: 'dot', name: 'Dot' },
    { type: 'circle', name: 'Circle' },
    { type: 'square', name: 'Square' },
    { type: 'chevron', name: 'Chevron' },
    { type: 'brackets', name: 'Brackets' },
    { type: 'diamond', name: 'Diamond' },
    { type: 'x', name: 'X' },
    { type: 'plus', name: 'Plus' },
    { type: 'star', name: 'FREE Crosshair' },
    { type: 'star6', name: 'Six-point Star' }
  ];
  const variants = ['01', '02', '03', '04', '05'];
  const presets = [];

  for (let index = 0; index < 50; index++) {
    const geometry = geometries[index % geometries.length];
    const variantIndex = Math.floor(index / geometries.length);
    presets.push({
      id: `${geometry.type}-${variants[variantIndex]}`,
      name: variantIndex === 0 ? geometry.name : `${geometry.name} ${variants[variantIndex]}`,
      type: geometry.type,
      size: [17, 24, 32, 38, 28][variantIndex],
      thickness: [1, 2, 3, 4, 2][variantIndex],
      gap: [1, 4, 7, 2, 10][variantIndex],
      outline: [1, 2, 2, 0, 3][variantIndex],
      centerDot: geometry.type === 'dot' || (index % 7 === 0),
      featured: variantIndex === 0
    });
  }

  const imageCache = new Map();

  function draw(ctx, settings, timeSeconds = 0) {
    if (settings.imageData) {
      drawUploadedImage(ctx, settings, settings.imageData);
      return;
    }

    const preset = (settings.type && presets.find((item) => item.type === settings.type)) ||
      presets.find((item) => item.id === settings.presetId) ||
      presets[0];
    const size = Math.max(4, (Number(settings.size) || preset.size) * (Number(settings.scale) || 100) / 100);
    const radius = size / 2;
    const thickness = Math.max(1, Number(settings.thickness) || preset.thickness);
    const gap = Math.max(0, Number(settings.gap) || 0);
    const outline = Math.max(0, Number(settings.outline) || 0);
    const rotation = (Number(settings.rotation) || 0) +
      (settings.spinning ? (Number(settings.spinSpeed) || 0) * timeSeconds * (settings.spinDirection === -1 ? -1 : 1) : 0);
    const color = settings.rainbow
      ? `hsl(${((timeSeconds * (Number(settings.rainbowSpeed) || 1) * 90) % 360 + 360) % 360} 100% 62%)`
      : settings.color;
    const alpha = Math.min(1, Math.max(0.05, Number(settings.opacity) / 100 || 1));
    const pulse = settings.pulse ? 0.72 + Math.sin(timeSeconds * 5) * 0.2 : 1;

    ctx.save();
    ctx.globalAlpha = alpha * pulse;
    ctx.rotate(rotation * Math.PI / 180);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (Number(settings.glowIntensity) > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = Number(settings.glowIntensity);
    } else if (Number(settings.shadowStrength) > 0) {
      ctx.shadowColor = 'rgba(0,0,0,.9)';
      ctx.shadowBlur = Number(settings.shadowStrength);
    }

    if (outline > 0) {
      ctx.strokeStyle = settings.outlineColor || '#05070a';
      ctx.fillStyle = settings.outlineColor || '#05070a';
      ctx.lineWidth = thickness + outline * 2;
      drawGeometry(ctx, preset.type, radius, gap, thickness, settings.centerDot);
    }
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = thickness;
    drawGeometry(ctx, preset.type, radius, gap, thickness, settings.centerDot);
    ctx.restore();
  }

  function drawUploadedImage(ctx, settings, source) {
    let image = imageCache.get(source);
    if (!image) {
      image = new Image();
      image.onload = () => imageCache.set(source, image);
      image.src = source;
      imageCache.set(source, image);
      return;
    }
    if (!image.complete || !image.naturalWidth) return;
    const size = Math.max(12, (Number(settings.size) || 32) * (Number(settings.scale) || 100) / 100) * 2;
    const ratio = image.naturalWidth / image.naturalHeight;
    const width = ratio >= 1 ? size : size * ratio;
    const height = ratio >= 1 ? size / ratio : size;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0.05, Number(settings.opacity) / 100 || 1));
    ctx.rotate((Number(settings.rotation) || 0) * Math.PI / 180);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  function drawGeometry(ctx, type, radius, gap, thickness, centerDot) {
    const start = Math.min(radius - 1, Math.max(0, gap + thickness));
    const half = thickness / 2;
    const line = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    switch (type) {
      case 'dot':
        filledDot(ctx, Math.max(2, thickness * 1.15));
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(3, radius - thickness), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'square':
        ctx.beginPath();
        ctx.rect(-radius + thickness / 2, -radius + thickness / 2,
          Math.max(1, radius * 2 - thickness), Math.max(1, radius * 2 - thickness));
        ctx.stroke();
        break;
      case 'chevron':
        line(-radius * 0.78, radius * 0.23, 0, -radius * 0.5);
        line(0, -radius * 0.5, radius * 0.78, radius * 0.23);
        line(0, -radius * 0.5, 0, -start);
        break;
      case 'brackets':
        for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          ctx.save();
          ctx.rotate(angle);
          line(-half, -radius, -half, -start);
          line(-half, -radius, half * 2, -radius);
          ctx.restore();
        }
        break;
      case 'diamond':
        polygon(ctx, 4, radius, -Math.PI / 2, 0.72);
        break;
      case 'x':
        for (const angle of [Math.PI / 4, Math.PI * 3 / 4]) {
          line(Math.cos(angle) * -radius, Math.sin(angle) * -radius,
            Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        break;
      case 'plus':
        ctx.fillRect(-half, -radius, thickness, radius * 2);
        ctx.fillRect(-radius, -half, radius * 2, thickness);
        break;
      case 'star':
        star(ctx, 10, radius, radius * 0.42, -Math.PI / 2);
        break;
      case 'star6':
        star(ctx, 6, radius, radius * 0.46, -Math.PI / 2);
        break;
      case 'cross':
      default:
        line(0, -radius, 0, -start);
        line(0, start, 0, radius);
        line(-radius, 0, -start, 0);
        line(start, 0, radius, 0);
    }
    if (centerDot && type !== 'dot') filledDot(ctx, Math.max(1.3, thickness * 0.65));
  }

  function filledDot(ctx, radius) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function polygon(ctx, points, radius, startAngle, yScale = 1) {
    ctx.beginPath();
    for (let index = 0; index < points; index++) {
      const angle = startAngle + index * Math.PI * 2 / points;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * yScale;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function star(ctx, points, outerRadius, innerRadius, startAngle) {
    ctx.beginPath();
    for (let index = 0; index < points * 2; index++) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = startAngle + index * Math.PI / points;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  window.CrosshairCore = { geometries, presets, draw };
})();
