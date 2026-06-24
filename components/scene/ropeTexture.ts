"use client";

// 절차적 로프 텍스처 — 3가닥 꼬임 + 섬유 잔결을 노멀맵/러프니스맵으로 굽고,
// fabric sheen(섬유 림라이트)을 더한 MeshPhysicalMaterial 를 제공한다. 클라이언트 1회 생성/공유.

import * as THREE from "three";

const STRANDS = 3; // 꼬임 가닥 수
const TILE_W = 768; // 길이 방향
const TILE_H = 192; // 둘레 방향

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// height(u,v): u=길이(0..1), v=둘레(0..1). 3가닥이 둘레로 배치되고 길이를 따라 1/STRANDS 비틀린다.
// 깊은 가닥 골 + 가닥 위 미세 섬유 + 잔노이즈로 굵은 꼬임줄 느낌.
function height(u: number, v: number): number {
  const tw = (STRANDS * v + u) * Math.PI * 2; // 비틀림 위상(이음매 seamless)
  let lobe = Math.cos(tw) * 0.5 + 0.5; // 0..1
  lobe = Math.pow(lobe, 0.42); // 봉우리 넓게, 골은 좁고 깊게
  // 가닥을 따라가는 미세 섬유(고주파, 봉우리에서 강함)
  const fiber = Math.sin(tw * 8.0) * 0.05 * (0.35 + 0.65 * lobe);
  // 봉우리를 가로지르는 잔결(직조감)
  const weave = Math.sin((6 * u - v) * Math.PI * 2 * STRANDS) * 0.015 * lobe;
  const n = (hash(Math.floor(u * 320), Math.floor(v * 130)) - 0.5) * 0.045;
  return lobe * 0.85 + fiber + weave + n;
}

function buildHeight(): Float32Array {
  const h = new Float32Array(TILE_W * TILE_H);
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) h[y * TILE_W + x] = height(x / TILE_W, y / TILE_H);
  }
  return h;
}

function makeNormalMap(h: Float32Array): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_W;
  canvas.height = TILE_H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TILE_W, TILE_H);
  const at = (x: number, y: number) => h[((y + TILE_H) % TILE_H) * TILE_W + ((x + TILE_W) % TILE_W)];
  const STRENGTH = 5.5;
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      const dhx = (at(x + 1, y) - at(x - 1, y)) * STRENGTH;
      const dhy = (at(x, y + 1) - at(x, y - 1)) * STRENGTH;
      const len = Math.hypot(dhx, dhy, 1);
      const i = (y * TILE_W + x) * 4;
      img.data[i] = (-dhx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dhy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function makeRoughnessMap(h: Float32Array): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_W;
  canvas.height = TILE_H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TILE_W, TILE_H);
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      const hv = h[y * TILE_W + x];
      const rough = 0.7 + (1 - Math.min(1, Math.max(0, hv))) * 0.28; // 골 더 거칠게
      const i = (y * TILE_W + x) * 4;
      const c = Math.max(0, Math.min(255, rough * 255));
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const REPEAT_LEN = 30;
let cached: { normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null = null;

export function getRopeTextures() {
  if (cached) return cached;
  const h = buildHeight();
  const normalMap = makeNormalMap(h);
  const roughnessMap = makeRoughnessMap(h);
  normalMap.repeat.set(REPEAT_LEN, 1);
  roughnessMap.repeat.set(REPEAT_LEN, 1);
  cached = { normalMap, roughnessMap };
  return cached;
}

/** 공유 로프 재질 — 꼬임 노멀/러프 + fabric sheen. 색만 다르게 여러 개 만들어 쓴다. */
export function makeRopeMaterial(color: string): THREE.MeshPhysicalMaterial {
  const tex = getRopeTextures();
  const base = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: base,
    roughness: 1,
    metalness: 0,
    roughnessMap: tex.roughnessMap,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(1.6, 1.6),
    sheen: 0.35,
    sheenRoughness: 0.9,
    sheenColor: base.clone().lerp(new THREE.Color("#fff4e0"), 0.25), // 은은한 섬유 림라이트(색 유지)
    envMapIntensity: 0.85,
  });
}
