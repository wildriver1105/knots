"use client";

// 로프가 감싸는 대상: 말뚝(pole) 또는 혼 클리트(cleat).
// 클리트는 primitive 조합으로 구성(베이스 바 + 두 뿔). 추후 GLTF 로 교체 가능.

import { getKnot } from "@/lib/knots/registry";
import { usePlayerStore } from "@/lib/player/store";
import type { Vec3 } from "@/lib/knots/types";

const WOOD = "#9a7b4f";
const METAL = "#c8ccd2";

function Pole({ radius, height, position, axis }: { radius: number; height: number; position?: Vec3; axis?: "x" | "y" | "z" }) {
  const rot: [number, number, number] = axis === "x" ? [0, 0, Math.PI / 2] : axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <mesh position={position ?? [0, 0, 0]} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, 32]} />
      <meshStandardMaterial color={WOOD} roughness={0.85} metalness={0} />
    </mesh>
  );
}

// 혼 클리트: x축 방향 베이스 + 양 끝 위로 솟은 뿔.
function Cleat({ scale = 1, position }: { scale?: number; position?: Vec3 }) {
  const s = scale;
  return (
    <group position={position ?? [0, -0.05, 0]} scale={[s, s, s]}>
      {/* 베이스 발 두 개 */}
      <mesh position={[-0.45, -0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.3, 0.34]} />
        <meshStandardMaterial color={METAL} roughness={0.45} metalness={0.6} />
      </mesh>
      <mesh position={[0.45, -0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.3, 0.34]} />
        <meshStandardMaterial color={METAL} roughness={0.45} metalness={0.6} />
      </mesh>
      {/* 가운데 베이스 바 */}
      <mesh position={[0, 0.12, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.14, 1.5, 24]} />
        <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.65} />
      </mesh>
      {/* 양 끝 뿔(테이퍼) */}
      {[-1, 1].map((dir) => (
        <mesh
          key={dir}
          position={[dir * 0.78, 0.2, 0]}
          rotation={[0, 0, dir * -0.5]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.08, 0.15, 0.5, 20]} />
          <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

export default function KnotObject() {
  const knotId = usePlayerStore((s) => s.knotId);
  const obj = getKnot(knotId).object;
  if (obj.kind === "pole") {
    return <Pole radius={obj.radius} height={obj.height} position={obj.position} axis={obj.axis ?? "y"} />;
  }
  if (obj.kind === "cleat") {
    return <Cleat scale={obj.scale} position={obj.position} />;
  }
  return null;
}
