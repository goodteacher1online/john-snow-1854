import { SOHO_STREETS } from '../data/streets';
import snowData from '../data/snowData.json';

interface Point {
  x: number;
  y: number;
}

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
    // 1. 가구 문 앞 및 마당 구역 (반경 55px 이내 보행 보장)
    for (const h of this.houses) {
      if (Math.hypot(h.x - x, h.y - y) <= 55) {
        return true;
      }
    }

    // 2. 공공 식수 펌프 주변 (반경 55px 이내 보행 보장)
    for (const p of this.pumps) {
      if (Math.hypot(p.x - x, p.y - y) <= 55) {
        return true;
      }
    }

    // 3. 도로 선분망 내부 보행 검사
    for (const street of this.streets) {
      const halfWidth = (street.width || 52) / 2;
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
   * 벽 미끄러짐(Wall Sliding) 적용 이동 계산
   * - 목표 위치가 길이면 즉시 이동
   * - 막혔을 경우 X축 또는 Y축만 개별 검사하여 길을 따라 자연스럽게 미끄러짐
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

    // 4. 모서리에 걸려 완전히 막힌 경우 정지
    return [curX, curY];
  }
}

export const navigator = new SohoNavigator();
