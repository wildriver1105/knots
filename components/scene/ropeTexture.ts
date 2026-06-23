"use client";

// 절차적 로프 텍스처 — 3가닥(혹은 N가닥) 꼬임 + 섬유 잔결을 노멀맵/러프니스맵으로 굽는다.
// 캔버스에서 height field 를 만들고 그라디언트로 노멀을 계산한다. 클라이언트에서 1회 생성 후 공유.

import * as THREE from "three";

const STRANDS = 3; // 꼬임 가닥 수
const TILE_W = 512; // 길이 방향
const TILE_H = 128; // 둘레 방향

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// height(u,v): u=길이(0..1), v=둘레(0..1).
// 3가닥이 둘레로 배치되고 길이를 따라 1/STRANDS 씩 비틀린다(타일 경계 seamless).
// 가닥 사이 깊은 골 + 각 가닥 위 미세 섬유결.
function height(u: number, v: number): number {
  const phase = STRANDS * v + u; // u:0→1 에 가닥 1칸 이동 → 반복 시 이음매 없음
  // 가닥 단면: 둥근 융기. 골을 깊게 하려고 |cos| 대신 부드러운 봉우리 사용.
  const strand = Math.cos(phase * Math.PI * 2) * 0.5 + 0.5; // 0..1
  const lobe = Math.pow(strand, 0.65); // 봉우리는 넓게, 골은 좁고 깊게
  // 가닥을 따라가는 미세 섬유결(고주파, 비틀림 방향)
  const fiber = Math.sin((STRANDS * v + u) * Math.PI * 2 * 9 + v * 30) * 0.05;
  // 잔잔한 노이즈로 자연스러운 거칠기
  const n = (hash(Math.floor(u * 220), Math.floor(v * 90)) - 0.5) * 0.05;
  return lobe + fiber + n;
}

function buildHeight(): Float32Array {
  const h = new Float32Array(TILE_W * TILE_H);
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      h[y * TILE_W + x] = height(x / TILE_W, y / TILE_H);
    }
  }
  return h;
}

function makeNormalMap(h: Float32Array): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_W;
  canvas.height = TILE_H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TILE_W, TILE_H);
  const at = (x: number, y: number) =>
    h[((y + TILE_H) % TILE_H) * TILE_W + ((x + TILE_W) % TILE_W)];
  const STRENGTH = 4.2;
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      const dhx = (at(x + 1, y) - at(x - 1, y)) * STRENGTH;
      const dhy = (at(x, y + 1) - at(x, y - 1)) * STRENGTH;
      // 노멀 = normalize(-dhx, -dhy, 1)
      const len = Math.hypot(dhx, dhy, 1);
      const nx = -dhx / len;
      const ny = -dhy / len;
      const nz = 1 / len;
      const i = (y * TILE_W + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
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
      // 골(낮은 height)은 더 거칠게(그림자/먼지), 봉우리는 약간 덜 거칠게
      const hv = h[y * TILE_W + x];
      const rough = 0.78 + (1 - hv) * 0.2; // 0.78..0.98
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

let cached: { normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null = null;

export function getRopeTextures() {
  if (cached) return cached;
  const h = buildHeight();
  const normalMap = makeNormalMap(h);
  const roughnessMap = makeRoughnessMap(h);
  // 길이 방향으로 여러 번 반복 → 촘촘한 꼬임. 둘레는 1회(가닥 STRANDS 개).
  const REPEAT_LEN = 26;
  normalMap.repeat.set(REPEAT_LEN, 1);
  roughnessMap.repeat.set(REPEAT_LEN, 1);
  cached = { normalMap, roughnessMap };
  return cached;
}
