"use client";

// 로프 재질 — 꼬임으로 오해되지 않는 매끈한 무광 MeshStandardMaterial 를 제공한다.
//
// 주의: 이전 버전의 절차적 노멀맵은 직선 로프도 "꽈배기처럼 꼬인 중심선"으로 보이게 했다.
// 학습용 매듭에서는 실제 경로/물리 변형이 먼저 읽혀야 하므로, 런타임 재질에는 노멀맵을 걸지 않는다.

import * as THREE from "three";

const TILE_W = 768; // 길이 방향
const TILE_H = 192; // 둘레 방향

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// height(u,v): u=길이(0..1), v=둘레(0..1).
// 길이 방향 섬유와 약한 둘레 불균일만 둔다. u와 v를 강하게 결합하지 않아 나선 무늬가 생기지 않는다.
function height(u: number, v: number): number {
  const circum = Math.cos(v * Math.PI * 2 * 5) * 0.018;
  const longFiber = Math.sin(u * Math.PI * 2 * 72 + v * 0.6) * 0.016;
  const fineFiber = Math.sin(u * Math.PI * 2 * 173 + v * 1.7) * 0.006;
  const n = (hash(Math.floor(u * 420), Math.floor(v * 160)) - 0.5) * 0.018;
  return 0.5 + circum + longFiber + fineFiber + n;
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
  const STRENGTH = 2.2;
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
      const rough = 0.78 + (1 - Math.min(1, Math.max(0, hv))) * 0.12;
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

const REPEAT_LEN = 7;
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

/** 공유 로프 재질 — 색만 선명하게 읽히는 매끈한 무광 로프. */
export function makeRopeMaterial(color: string): THREE.MeshStandardMaterial {
  const base = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: base,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.08,
  });
}
