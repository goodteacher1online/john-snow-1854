import { SnowGameData, House, Pump, PlayerState, InvestigationRecord } from '../types.ts';
import { SOHO_STREETS, SOHO_BLOCKS } from '../data/streets.ts';

export class SohoMapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: SnowGameData;
  
  // 카메라 뷰포트
  public cameraX = 500;
  public cameraY = 500;
  public zoom = 1.6;
  public targetZoom = 1.6;
  
  // 미아스마 안개 오버레이 활성 여부
  public showMiasmaFog = true;

  constructor(canvas: HTMLCanvasElement, data: SnowGameData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.data = data;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // 월드 좌표(0~1000)를 화면 픽셀 좌표로 변환
  public worldToScreen(wx: number, wy: number): [number, number] {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const sx = cx + (wx - this.cameraX) * this.zoom;
    const sy = cy + (wy - this.cameraY) * this.zoom;
    return [sx, sy];
  }

  // 화면 좌표를 월드 좌표(0~1000)로 역변환
  public screenToWorld(sx: number, sy: number): [number, number] {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const wx = this.cameraX + (sx - cx) / this.zoom;
    const wy = this.cameraY + (sy - cy) / this.zoom;
    return [wx, wy];
  }

  public render(
    myPlayer: PlayerState,
    otherPlayers: PlayerState[],
    investigations: Record<string, InvestigationRecord>,
    broadHandleRemoved: boolean
  ) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // 카메라 부드러운 추적 (Lerp)
    this.cameraX += (myPlayer.x - this.cameraX) * 0.12;
    this.cameraY += (myPlayer.y - this.cameraY) * 0.12;
    this.zoom += (this.targetZoom - this.zoom) * 0.1;

    // 1. 빅토리안 양피지 고지도 배경 (#f4ecd8)
    ctx.fillStyle = '#f3ebd5';
    ctx.fillRect(0, 0, width, height);

    // 미세한 고지도 그리드 라인
    ctx.strokeStyle = 'rgba(160, 140, 110, 0.2)';
    ctx.lineWidth = 1;
    const gridSize = 100 * this.zoom;
    const startX = ((-this.cameraX * this.zoom + width / 2) % gridSize + gridSize) % gridSize;
    const startY = ((-this.cameraY * this.zoom + height / 2) % gridSize + gridSize) % gridSize;
    for (let x = startX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = startY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. 특수 구역 및 건물 블록 (양조장, 구빈원, 광장)
    for (const block of SOHO_BLOCKS) {
      ctx.beginPath();
      const first = this.worldToScreen(block.polygon[0][0], block.polygon[0][1]);
      ctx.moveTo(first[0], first[1]);
      for (let i = 1; i < block.polygon.length; i++) {
        const pt = this.worldToScreen(block.polygon[i][0], block.polygon[i][1]);
        ctx.lineTo(pt[0], pt[1]);
      }
      ctx.closePath();

      if (block.id === 'brewery_block') {
        ctx.fillStyle = 'rgba(215, 180, 130, 0.45)'; // 맥주 양조장 호박색 톤
      } else if (block.id === 'workhouse_block') {
        ctx.fillStyle = 'rgba(180, 180, 190, 0.45)'; // 구빈원 석조 톤
      } else {
        ctx.fillStyle = 'rgba(200, 215, 190, 0.4)'; // 공원/광장 톤
      }
      ctx.fill();
      ctx.strokeStyle = '#8c7b64';
      ctx.lineWidth = 1.5 * this.zoom;
      ctx.stroke();

      // 구역 라벨
      if (block.label) {
        const center = this.worldToScreen(
          (block.polygon[0][0] + block.polygon[2][0]) / 2,
          (block.polygon[0][1] + block.polygon[2][1]) / 2
        );
        ctx.font = `italic bold ${Math.max(10, 11 * this.zoom)}px 'Georgia', serif`;
        ctx.fillStyle = '#5a4d3b';
        ctx.textAlign = 'center';
        ctx.fillText(block.label, center[0], center[1]);
      }
    }

    // 3. 소호 거리 도로망 렌더링
    for (const street of SOHO_STREETS) {
      ctx.beginPath();
      const [startWx, startWy] = street.points[0];
      const [startSx, startSy] = this.worldToScreen(startWx, startWy);
      ctx.moveTo(startSx, startSy);
      for (let i = 1; i < street.points.length; i++) {
        const [wx, wy] = street.points[i];
        const [sx, sy] = this.worldToScreen(wx, wy);
        ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = '#e2d3b4'; // 도로 내부
      ctx.lineWidth = (street.isMain ? 24 : 16) * this.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 도로 테두리 라인
      ctx.strokeStyle = '#c4b293';
      ctx.lineWidth = (street.isMain ? 26 : 18) * this.zoom;
      ctx.stroke();

      // 도로명 표기
      const midIdx = Math.floor(street.points.length / 2);
      const [mx, my] = this.worldToScreen(street.points[midIdx][0], street.points[midIdx][1]);
      ctx.font = `600 ${Math.max(9, 10 * this.zoom)}px 'Times New Roman', serif`;
      ctx.fillStyle = '#6b5e4c';
      ctx.textAlign = 'center';
      ctx.fillText(street.name.toUpperCase(), mx, my - 6 * this.zoom);
    }

    // 4. 가구 (Houses) 렌더링
    for (const house of this.data.houses) {
      const [hx, hy] = this.worldToScreen(house.x, house.y);
      const isInvestigated = !!investigations[house.id];

      // 건물 기호 (사각형 지붕)
      const size = 12 * this.zoom;
      ctx.save();
      ctx.translate(hx, hy);

      if (isInvestigated) {
        // 조사 완료: 역사적 역학 지도 기호!
        // 사망자 수에 따른 붉은 막대(Bar) 또는 점(Dot) 누적
        if (house.deaths > 0) {
          ctx.fillStyle = '#b91c1c'; // 심홍색 사망 점
          ctx.beginPath();
          ctx.arc(0, 0, Math.min(18, (4 + house.deaths * 1.8) * this.zoom), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 사망자 숫자 표기
          ctx.font = `bold ${Math.max(9, 11 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(house.deaths), 0, 0);
        } else {
          // 사망자 0명 (양조장 등 이상치): 녹색 체크 쉴드
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(0, 0, 8 * this.zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.font = `bold ${Math.max(8, 10 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText("0", 0, 0);
        }
      } else {
        // 미조사 가구: 고풍스러운 흑갈색 건물 벽돌
        ctx.fillStyle = '#786953';
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeStyle = '#3e3427';
        ctx.lineWidth = 1 * this.zoom;
        ctx.strokeRect(-size / 2, -size / 2, size, size);

        // 상호작용 가능 유도 펄스
        const distToPlayer = Math.hypot(house.x - myPlayer.x, house.y - myPlayer.y);
        if (distToPlayer < 35) {
          ctx.beginPath();
          ctx.arc(0, 0, (size + Math.sin(Date.now() / 200) * 3) * this.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.stroke();

          // "조사 [E]" 말풍선
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-22 * this.zoom, -26 * this.zoom, 44 * this.zoom, 16 * this.zoom);
          ctx.font = `bold ${Math.max(9, 10 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#fef08a';
          ctx.textAlign = 'center';
          ctx.fillText("조사 [E]", 0, -14 * this.zoom);
        }
      }
      ctx.restore();
    }

    // 5. 공공 식수 펌프 (Pumps) 렌더링
    for (const pump of this.data.pumps) {
      const [px, py] = this.worldToScreen(pump.x, pump.y);
      const isBroad = pump.isSource;

      ctx.save();
      ctx.translate(px, py);

      // 펌프 밑받침 원
      ctx.beginPath();
      ctx.arc(0, 0, (isBroad ? 14 : 9) * this.zoom, 0, Math.PI * 2);
      ctx.fillStyle = isBroad ? (broadHandleRemoved ? '#64748b' : '#0284c7') : '#475569';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2 * this.zoom;
      ctx.stroke();

      // 펌프 아이콘 (수동 펌프 모양)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2 * this.zoom, -8 * this.zoom, 4 * this.zoom, 12 * this.zoom);
      // 손잡이
      if (!isBroad || !broadHandleRemoved) {
        ctx.beginPath();
        ctx.moveTo(0, -6 * this.zoom);
        ctx.lineTo(8 * this.zoom, -2 * this.zoom);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2 * this.zoom;
        ctx.stroke();
      }

      // 펌프 라벨
      ctx.font = `bold ${Math.max(9, 10 * this.zoom)}px 'Georgia', serif`;
      ctx.fillStyle = isBroad ? '#0369a1' : '#334155';
      ctx.textAlign = 'center';
      const label = pump.name + (isBroad && broadHandleRemoved ? " [손잡이 제거됨!]" : "");
      ctx.fillText(label, 0, 18 * this.zoom);

      // 브로드 펌프 손잡이 제거 상호작용
      if (isBroad && !broadHandleRemoved) {
        const dist = Math.hypot(pump.x - myPlayer.x, pump.y - myPlayer.y);
        if (dist < 40) {
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(-45 * this.zoom, -32 * this.zoom, 90 * this.zoom, 18 * this.zoom);
          ctx.font = `bold ${Math.max(9, 10 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText("손잡이 제거 [Space]", 0, -19 * this.zoom);
        }
      }
      ctx.restore();
    }

    // 6. 장기설(Miasma) 악취 마커 & 안개 오버레이
    if (this.showMiasmaFog) {
      for (const m of this.data.miasmaMarkers) {
        const [mx, my] = this.worldToScreen(m.x, m.y);
        const grad = ctx.createRadialGradient(mx, my, 5 * this.zoom, mx, my, 80 * this.zoom);
        grad.addColorStop(0, 'rgba(100, 140, 60, 0.35)'); // 독성 녹색 스모그
        grad.addColorStop(1, 'rgba(100, 140, 60, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, 80 * this.zoom, 0, Math.PI * 2);
        ctx.fill();

        // 냄새 마커 텍스트
        ctx.font = `italic ${Math.max(8, 9 * this.zoom)}px serif`;
        ctx.fillStyle = '#3f5223';
        ctx.textAlign = 'center';
        ctx.fillText(`💨 ${m.name}`, mx, my + 14 * this.zoom);
      }
    }

    // 7. 다른 플레이어 아바타 렌더링
    for (const player of otherPlayers) {
      this.drawAvatar(player.x, player.y, player.name, player.color, player.team, false);
    }

    // 8. 내 아바타 렌더링 (최상단)
    this.drawAvatar(myPlayer.x, myPlayer.y, `${myPlayer.name} (나)`, myPlayer.color, myPlayer.team, true);
  }

  // 조사관 아바타 드로잉
  private drawAvatar(wx: number, wy: number, name: string, color: string, team: string, isMe: boolean) {
    const [sx, sy] = this.worldToScreen(wx, wy);
    const ctx = this.ctx;
    const r = 9 * this.zoom;

    ctx.save();
    ctx.translate(sx, sy);

    // 하단 그림자
    ctx.beginPath();
    ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // 몸체 (조사관 코트)
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isMe ? '#ffffff' : '#0f172a';
    ctx.lineWidth = isMe ? 2.5 : 1.5;
    ctx.stroke();

    // 빅토리안 조사관 모자 (중절모 실루엣)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-r * 0.9, -r * 1.1, r * 1.8, 2.5 * this.zoom); // 챙
    ctx.fillRect(-r * 0.5, -r * 1.6, r, 5 * this.zoom); // 모자 윗부분

    // 이름 태그 및 팀 배지
    ctx.font = `bold ${Math.max(9, 10 * this.zoom)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(name, 0, -r * 1.9);

    ctx.restore();
  }
}
