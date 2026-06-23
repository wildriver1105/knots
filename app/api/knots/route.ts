// 매듭 데이터 API — 프로젝트 루트의 knots.data.json 을 읽고 쓴다.
//  GET    → 전체 매듭(파일 없으면 시드로 생성)
//  PUT    → 매듭 1개 upsert(저장/수정)
//  DELETE ?id=  → 빌트인이면 시드로 리셋, 커스텀이면 삭제
//
// 빌트인은 lib/knots/data 의 BUILTIN_SEED 로 "최초 1회" 파일을 만든다(=공장 기본값).
// 이후 런타임은 항상 파일에서 불러온다(하드코딩 사용 안 함).

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { BUILTIN_SEED } from "@/lib/knots/data";
import type { Knot } from "@/lib/knots/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FILE = path.join(process.cwd(), "knots.data.json");

async function readAll(): Promise<Knot[]> {
  let knots: Knot[];
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    knots = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.knots) ? parsed.knots : null;
    if (!knots) throw new Error("bad shape");
  } catch {
    knots = [...BUILTIN_SEED];
    await writeAll(knots);
    return knots;
  }
  // 빌트인 시드 중 파일에 없는 게 있으면 추가(코드에 새 빌트인이 생긴 경우).
  const have = new Set(knots.map((k) => k.id));
  let changed = false;
  for (const s of BUILTIN_SEED) {
    if (!have.has(s.id)) {
      knots.push(s);
      changed = true;
    }
  }
  if (changed) await writeAll(knots);
  return knots;
}

async function writeAll(knots: Knot[]): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(knots, null, 2), "utf8");
}

export async function GET() {
  const knots = await readAll();
  return NextResponse.json({ knots });
}

export async function PUT(req: NextRequest) {
  const knot = (await req.json()) as Knot;
  if (!knot?.id) return NextResponse.json({ ok: false, error: "no id" }, { status: 400 });
  const all = await readAll();
  const idx = all.findIndex((k) => k.id === knot.id);
  if (idx >= 0) all[idx] = knot;
  else all.push(knot);
  await writeAll(all);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "no id" }, { status: 400 });
  const seed = BUILTIN_SEED.find((k) => k.id === id);
  let all = await readAll();
  if (seed) {
    // 빌트인: 공장 기본값으로 리셋
    const idx = all.findIndex((k) => k.id === id);
    if (idx >= 0) all[idx] = seed;
    else all.push(seed);
  } else {
    all = all.filter((k) => k.id !== id);
  }
  await writeAll(all);
  return NextResponse.json({ ok: true });
}
