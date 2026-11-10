import { SOHO_STREETS } from '../data/streets';
import snowData from '../data/snowData.json';

// 점 (px, py)에서 선분 (ax, ay)-(bx, by)까지의 최단 거리 계산
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export class SohoNavigator {
  private streets = SOHO_STREETS;
  private houses = snowData.houses;
  private pumps = snowData.pumps;

  /**
   * 해당 월드 좌표 (x, y)가 도로 위이거나 가구/펌프 접근 구역인지 판정
   */
  public canWalkAt(x: number, y: number): boolean {
    // 1. 가구 문 앞 및 마당 구역 (반경 100px 이내 넉넉하게 보행 보장)
    for (const h of this.houses) {
      if (Math.hypot(h.x - x, h.y - y) <= 100) {
        return true;
      }
    }

    // 2. 공공 식수 펌프 주변 (반경 100px 이내 넉넉하게 보행 보장)
    for (const p of this.pumps) {
      if (Math.hypot(p.x - x, p.y - y) <= 100) {
        return true;
      }
    }

    // 3. 24개 실제 1854 소호 도로망 내부 보행 검사 (고지도 길 위에서 자유롭게 이동)
    for (const street of this.streets) {
      const halfWidth = (street.width || 95) / 2;
      const pts = street.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const dist = distToSegment(x, y, ax, ay, bx, by);
        if (dist <= halfWidth) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 벽 미끄러짐(Wall Sliding) 적용 부드러운 보행 이동 계산
   */
  public resolveMove(curX: number, curY: number, dx: number, dy: number): [number, number] {
    const nextX = curX + dx;
    const nextY = curY + dy;

    // 1. 대각선/직진 방향이 모두 길이면 즉시 허용
    if (this.canWalkAt(nextX, nextY)) {
      return [nextX, nextY];
    }

    // 2. X축만 먼저 시도 (가로 벽 슬라이딩)
    if (dx !== 0 && this.canWalkAt(nextX, curY)) {
      return [nextX, curY];
    }

    // 3. Y축만 시도 (세로 벽 슬라이딩)
    if (dy !== 0 && this.canWalkAt(curX, nextY)) {
      return [curX, nextY];
    }

    // 4. 벽에 완전히 닿아 막힌 경우 정지
    return [curX, curY];
  }
}

export const navigator = new SohoNavigator();
