import * as THREE from 'three';
import type { DiceSkinId } from '../game/types';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createWoodTextures(
  baseColor: string,
  grainColor: string,
  maxAnisotropy = 4,
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [albedoCanvas, aCtx] = makeCanvas(512, 512);
  const [bumpCanvas, bCtx] = makeCanvas(512, 512);

  aCtx.fillStyle = baseColor;
  aCtx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 140; i++) {
    const y = (i / 140) * 512;
    const thickness = 1 + (i % 3);
    aCtx.strokeStyle = grainColor;
    aCtx.globalAlpha = 0.08 + ((i * 17) % 10) * 0.015;
    aCtx.lineWidth = thickness;
    aCtx.beginPath();
    aCtx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) {
      const wave = Math.sin(x * 0.015 + i * 0.4) * 6;
      aCtx.lineTo(x, y + wave);
    }
    aCtx.stroke();

    bCtx.strokeStyle = i % 2 === 0 ? '#a4a4a4' : '#5e5e5e';
    bCtx.globalAlpha = 0.25;
    bCtx.lineWidth = thickness;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) {
      const wave = Math.sin(x * 0.015 + i * 0.4) * 6;
      bCtx.lineTo(x, y + wave);
    }
    bCtx.stroke();
  }
  aCtx.globalAlpha = 1;
  bCtx.globalAlpha = 1;

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

export function createMarbleTextures(
  baseColor: string,
  veinColor: string,
  maxAnisotropy = 4,
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [albedoCanvas, aCtx] = makeCanvas(512, 512);
  const [bumpCanvas, bCtx] = makeCanvas(512, 512);

  aCtx.fillStyle = baseColor;
  aCtx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  for (let v = 0; v < 22; v++) {
    aCtx.strokeStyle = veinColor;
    aCtx.globalAlpha = 0.12 + (v % 4) * 0.05;
    aCtx.lineWidth = 1 + (v % 3) * 1.1;
    bCtx.strokeStyle = '#686868';
    bCtx.globalAlpha = 0.16;
    bCtx.lineWidth = aCtx.lineWidth;

    let x = (v * 67) % 512;
    let y = 0;
    aCtx.beginPath();
    bCtx.beginPath();
    aCtx.moveTo(x, y);
    bCtx.moveTo(x, y);
    for (let step = 0; step < 18; step++) {
      y += 30;
      x += Math.sin(step * 0.9 + v) * 24 + Math.cos(v * 2.1) * 10;
      aCtx.lineTo(x, y);
      bCtx.lineTo(x, y);
    }
    aCtx.stroke();
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

export function createStarTileTexture(
  bgHex: string,
  starHex: string,
  borderHex: string,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle recessed border
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 232, 232);

  // Crisp 5-point star
  ctx.save();
  ctx.translate(128, 128);
  ctx.fillStyle = starHex;
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  const outer = 68;
  const inner = 29;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStartArrowTexture(
  bgHex: string,
  arrowHex: string,
  angleRad: number,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 232, 232);

  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(angleRad);
  ctx.fillStyle = arrowHex;
  ctx.beginPath();
  ctx.moveTo(58, 0);
  ctx.lineTo(-10, -48);
  ctx.lineTo(-10, -20);
  ctx.lineTo(-56, -20);
  ctx.lineTo(-56, 20);
  ctx.lineTo(-10, 20);
  ctx.lineTo(-10, 48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.26, 0.26],
    [0.5, 0.5],
    [0.74, 0.74],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.26, 0.26],
    [0.74, 0.26],
    [0.5, 0.5],
    [0.26, 0.74],
    [0.74, 0.74],
  ],
  6: [
    [0.27, 0.23],
    [0.73, 0.23],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.77],
    [0.73, 0.77],
  ],
};

export function createDiceFaceTexture(
  value: 1 | 2 | 3 | 4 | 5 | 6,
  skin: DiceSkinId,
  maxAnisotropy = 4,
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const [canvas, ctx] = makeCanvas(256, 256);
  const [bCanvas, bCtx] = makeCanvas(256, 256);

  const palette = {
    ivory_classic: { bg: '#f6f0e4', pip: '#1d1815', accent: '#b92b27', border: '#dfd4c0' },
    obsidian_gold: { bg: '#151518', pip: '#eab308', accent: '#f59e0b', border: '#3f3829' },
    ruby_crystal: { bg: '#8a121b', pip: '#f8fafc', accent: '#fde047', border: '#540a10' },
    brushed_titanium: { bg: '#94a3b8', pip: '#0f172a', accent: '#1e293b', border: '#64748b' },
  }[skin];

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle recessed border ring
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 236, 236);

  bCtx.fillStyle = '#c8c8c8';
  bCtx.fillRect(0, 0, 256, 256);

  const radius = value === 1 ? 30 : 21;
  const pipColor = value === 1 && skin === 'ivory_classic' ? palette.accent : palette.pip;

  for (const [nx, ny] of PIP_POSITIONS[value]) {
    const cx = nx * 256;
    const cy = ny * 256;

    // Subtle bevel ring around pip
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = pipColor;
    ctx.fill();

    // Specular micro-dot inside pip
    ctx.beginPath();
    ctx.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();

    // Recessed bump map
    const grad = bCtx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    grad.addColorStop(0, '#202020');
    grad.addColorStop(1, '#c8c8c8');
    bCtx.beginPath();
    bCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    bCtx.fillStyle = grad;
    bCtx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}
