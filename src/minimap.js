import { S } from './tile.js';

const PX = 150, RANGE = 300; // 화면 크기(px), 플레이어 주변 반경(m)

// 현재 위치 주변의 도로·건물과 플레이어 방향을 보여주는 미니맵 (북쪽이 위)
export function createMinimap(canvas, tiles) {
  const dpr = Math.min(devicePixelRatio, 2), k = PX / 2 / RANGE;
  canvas.width = canvas.height = PX * dpr;
  const ctx = canvas.getContext('2d');
  return function draw(player, heading) {
    const { x: cx, z: cz } = player.pos;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#c9d3b8';
    ctx.fillRect(0, 0, PX, PX);
    ctx.translate(PX / 2, PX / 2);
    ctx.scale(k, k);
    ctx.translate(-cx, -cz);    // 이제 월드 (x, z)를 그대로 그리면 됨
    ctx.strokeStyle = '#6b6f76';
    ctx.lineCap = 'round';
    for (const t of tiles.loaded.values()) {
      if (!t || t.off.x > cx + RANGE || t.off.x + S < cx - RANGE || t.off.z > cz + RANGE || t.off.z + S < cz - RANGE) continue;
      for (const { w, line } of t.roads) {
        ctx.lineWidth = Math.max(w, 1.5 / k);
        ctx.beginPath();
        for (const [x, y] of line) ctx.lineTo(t.off.x + x, t.off.z - y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#8d8676';
    for (const c of player.colliders) {
      const b = c.box;
      if (b.min.x > cx + RANGE || b.max.x < cx - RANGE || b.min.z > cz + RANGE || b.max.z < cz - RANGE) continue;
      ctx.beginPath();
      for (const [x, z] of c.pts) ctx.lineTo(x, z);
      ctx.fill();
    }
    ctx.setTransform(dpr, 0, 0, dpr, PX / 2 * dpr, PX / 2 * dpr);
    ctx.rotate(-heading);       // heading = atan2(x, z): 0이면 남쪽(+z, 화면 아래)
    ctx.fillStyle = '#e8413a';
    ctx.beginPath();
    ctx.moveTo(0, 8); ctx.lineTo(5, -6); ctx.lineTo(0, -3); ctx.lineTo(-5, -6);
    ctx.fill();
  };
}
