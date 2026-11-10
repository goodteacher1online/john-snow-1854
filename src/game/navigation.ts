// 1854 소호 자유 이동 내비게이터 (지도 전체를 자유롭게 누비며 막힘 없는 쾌적한 이동 보장)
export class SohoNavigator {
  // 월드 지도 크기 (2200 x 2064)
  private readonly minX = 40;
  private readonly maxX = 2160;
  private readonly minY = 40;
  private readonly maxY = 2020;

  /**
   * 해당 월드 좌표 (x, y)가 맵 유효 영역 내에 있는지 판정 (자유 이동)
   */
  public canWalkAt(x: number, y: number): boolean {
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
  }

  /**
   * 부드러운 자유 이동 계산 (맵 경계 클램핑)
   */
  public resolveMove(curX: number, curY: number, dx: number, dy: number): [number, number] {
    const nextX = Math.max(this.minX, Math.min(this.maxX, curX + dx));
    const nextY = Math.max(this.minY, Math.min(this.maxY, curY + dy));
    return [nextX, nextY];
  }
}

export const navigator = new SohoNavigator();
