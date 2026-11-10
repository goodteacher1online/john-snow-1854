import { SnowGameData, House, Pump, PlayerState, InvestigationRecord } from '../types.ts';
import { SOHO_STREETS, SOHO_BLOCKS } from '../data/streets.ts';

export class SohoMapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: SnowGameData;
  
  // 1854 실제 원본 고지도 이미지 에셋
  private mapImage: HTMLImageElement | null = null;
  private mapLoaded = false;

  // 카메라 뷰포트
  public cameraX = 500;
  public cameraY = 500;
  public zoom = 1.6;
  public targetZoom = 1.6;
  
  // 미아스마 안개 오버레이
  public showMiasmaFog = true;

  // 걷기 및 파동 애니메이션 타이머
  private animTick = 0;

  constructor(canvas: HTMLCanvasElement, data: SnowGameData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.data = data;
    this.loadAuthenticMap();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // 실제 1854 존 스노우 고지도 이미지 비동기 로딩
  private loadAuthenticMap() {
    const img = new Image();
    img.src = './assets/snow_map.jpg';
    img.onload = () => {
      this.mapImage = img;
      this.mapLoaded = true;
    };
    img.onerror = () => {
      console.warn('[Renderer] 고지도 이미지 로드 실패, 프로시저 양피지 렌더러로 대체');
      this.mapLoaded = false;
    };
  }

  public resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  public worldToScreen(wx: number, wy: number): [number, number] {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const sx = cx + (wx - this.cameraX) * this.zoom;
    const sy = cy + (wy - this.cameraY) * this.zoom;
    return [sx, sy];
  }

  public render(
    myPlayer: PlayerState,
    otherPlayers: PlayerState[],
    investigations: Record<string, InvestigationRecord>,
    broadHandleRemoved: boolean,
    isMoving: boolean
  ) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.animTick += isMoving ? 0.22 : 0.05;

    // 부드러운 카메라 추적 (Lerp)
    this.cameraX += (myPlayer.x - this.cameraX) * 0.12;
    this.cameraY += (myPlayer.y - this.cameraY) * 0.12;
    this.zoom += (this.targetZoom - this.zoom) * 0.1;

    // 1. 실제 1854 존 스노우 고지도 원본 배경 렌더링! (약도 탈피, 극적 현실감!)
    ctx.fillStyle = '#ecdcb0'; // 기본 양피지 배경
    ctx.fillRect(0, 0, width, height);

    if (this.mapLoaded && this.mapImage) {
      // 실제 고지도 텍스처를 월드 좌표 (0, 0) ~ (1000, 1000) 범위에 맞춰 렌더링
      const [originX, originY] = this.worldToScreen(0, 0);
      const mapW = 1000 * this.zoom;
      const mapH = 1000 * this.zoom;

      ctx.save();
      ctx.drawImage(this.mapImage, originX, originY, mapW, mapH);

      // 고풍스러운 빈티지 비네팅 효과 (Vignette)
      const vigGrad = ctx.createRadialGradient(
        originX + mapW / 2, originY + mapH / 2, mapW * 0.35,
        originX + mapW / 2, originY + mapH / 2, mapW * 0.65
      );
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(60, 40, 20, 0.45)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(originX, originY, mapW, mapH);
      ctx.restore();
    } else {
      // Fallback: 정밀 잉크 해칭 양피지 고지도
      this.renderFallbackMap(ctx, width, height);
    }

    // 2. 가로등 조명 효과 (19세기 런던 밤거리 가스등의 은은한 오렌지 앰비언트 글로우)
    this.renderGasLamps(ctx);

    // 3. 브로드 스트리트 펌프 감염 동심원 파동 (역학 위험 지대)
    const investigatedCount = Object.keys(investigations).length;
    if (investigatedCount > 0) {
      const broadPump = this.data.pumps.find(p => p.isSource);
      if (broadPump) {
        const [bx, by] = this.worldToScreen(broadPump.x, broadPump.y);
        const radius = Math.min(240, (70 + investigatedCount * 7.5)) * this.zoom;
        const heatGrad = ctx.createRadialGradient(bx, by, 10 * this.zoom, bx, by, radius);
        heatGrad.addColorStop(0, 'rgba(185, 28, 28, 0.35)');
        heatGrad.addColorStop(0.5, 'rgba(220, 38, 38, 0.16)');
        heatGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = heatGrad;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();

        // 파동 펄스 링
        ctx.strokeStyle = 'rgba(185, 28, 28, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(bx, by, radius * (0.85 + Math.sin(this.animTick * 0.5) * 0.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 4. 가구 (Houses) 렌더링 - 사실적 건물 및 큼직한 인터랙션
    for (const house of this.data.houses) {
      const [hx, hy] = this.worldToScreen(house.x, house.y);
      const isInvestigated = !!investigations[house.id];
      const distToPlayer = Math.hypot(house.x - myPlayer.x, house.y - myPlayer.y);

      ctx.save();
      ctx.translate(hx, hy);

      if (isInvestigated) {
        // [조사 완료] 역학 지도 붉은 점 (존 스노우 원본 지도 스타일)
        if (house.deaths > 0) {
          const dotR = Math.min(24, (6 + house.deaths * 2.4) * this.zoom);
          ctx.beginPath();
          ctx.arc(0, 0, dotR, 0, Math.PI * 2);
          ctx.fillStyle = '#b91c1c';
          ctx.fill();
          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // 사망자 숫자 (큼직하고 굵게)
          ctx.font = `900 ${Math.max(11, 13 * this.zoom)}px -apple-system, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(house.deaths), 0, 0);
        } else {
          // 사망자 0명 (양조장 등 이상치): 승리의 녹색 쉴드
          ctx.beginPath();
          ctx.arc(0, 0, 13 * this.zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#16a34a';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.font = `900 ${Math.max(10, 12 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText("0", 0, 0);
        }
      } else {
        // [미조사 가구] 19세기 붉은 벽돌 주택 그래픽
        const size = 16 * this.zoom;
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeStyle = '#3e1509';
        ctx.lineWidth = 2;
        ctx.strokeRect(-size / 2, -size / 2, size, size);

        // 지붕 박공
        ctx.beginPath();
        ctx.moveTo(-size / 2, -size / 2);
        ctx.lineTo(0, -size);
        ctx.lineTo(size / 2, -size / 2);
        ctx.closePath();
        ctx.fillStyle = '#451a03';
        ctx.fill();
        ctx.stroke();

        // 굴뚝
        ctx.fillStyle = '#78350f';
        ctx.fillRect(size * 0.2, -size * 1.1, 4 * this.zoom, 6 * this.zoom);

        // ★ [핵심] 가구 접근 시 큼직한 황금빛 펄스 링 & 머리 위 3D 뱃지
        if (distToPlayer < 48) {
          const pulse = (Math.sin(this.animTick * 2.5) + 1) / 2;
          ctx.beginPath();
          ctx.arc(0, 0, (size + pulse * 14) * this.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245, 158, 11, ${1 - pulse * 0.6})`;
          ctx.lineWidth = 3.5;
          ctx.stroke();

          // 머리 위 3D [조사 E] 뱃지
          ctx.save();
          ctx.translate(0, -size * 1.7);
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.roundRect(-28 * this.zoom, -14 * this.zoom, 56 * this.zoom, 28 * this.zoom, 8 * this.zoom);
          ctx.fill();
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.font = `900 ${Math.max(12, 14 * this.zoom)}px -apple-system, sans-serif`;
          ctx.fillStyle = '#0c0a09';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText("조사 [E]", 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // 5. 공공 식수 펌프 (Pumps)
    for (const pump of this.data.pumps) {
      const [px, py] = this.worldToScreen(pump.x, pump.y);
      const isBroad = pump.isSource;

      ctx.save();
      ctx.translate(px, py);

      // 대리석 원형 기단
      ctx.beginPath();
      ctx.arc(0, 0, (isBroad ? 18 : 11) * this.zoom, 0, Math.PI * 2);
      ctx.fillStyle = isBroad ? (broadHandleRemoved ? '#475569' : '#0284c7') : '#334155';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3 * this.zoom;
      ctx.stroke();

      // 무쇠 주물 기둥
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-3.5 * this.zoom, -12 * this.zoom, 7 * this.zoom, 16 * this.zoom);

      // 주물 손잡이
      if (!isBroad || !broadHandleRemoved) {
        ctx.beginPath();
        ctx.moveTo(0, -9 * this.zoom);
        ctx.lineTo(12 * this.zoom, -2 * this.zoom);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 3 * this.zoom;
        ctx.stroke();
      }

      // 펌프 이름 명판 (크고 굵게)
      ctx.font = `bold ${Math.max(11, 13 * this.zoom)}px 'Georgia', serif`;
      ctx.fillStyle = isBroad ? '#0369a1' : '#1e293b';
      ctx.textAlign = 'center';
      const label = pump.name + (isBroad && broadHandleRemoved ? " [손잡이 제거됨!]" : "");
      ctx.fillText(label, 0, 24 * this.zoom);

      // 브로드 펌프 손잡이 제거 인터랙션
      if (isBroad && !broadHandleRemoved) {
        const dist = Math.hypot(pump.x - myPlayer.x, pump.y - myPlayer.y);
        if (dist < 48) {
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.roundRect(-65 * this.zoom, -42 * this.zoom, 130 * this.zoom, 26 * this.zoom, 8 * this.zoom);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.font = `900 ${Math.max(11, 13 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText("손잡이 제거 [Space]", 0, -25 * this.zoom);
        }
      }
      ctx.restore();
    }

    // 6. 미아스마 악취 스모그 안개
    if (this.showMiasmaFog) {
      for (const m of this.data.miasmaMarkers) {
        const [mx, my] = this.worldToScreen(m.x, m.y);
        const fogR = (85 + Math.sin(this.animTick + m.x) * 12) * this.zoom;
        const grad = ctx.createRadialGradient(mx, my, 5 * this.zoom, mx, my, fogR);
        grad.addColorStop(0, 'rgba(80, 120, 30, 0.45)');
        grad.addColorStop(1, 'rgba(80, 120, 30, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, fogR, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `italic bold ${Math.max(10, 11 * this.zoom)}px serif`;
        ctx.fillStyle = '#223310';
        ctx.textAlign = 'center';
        ctx.fillText(`💨 ${m.name}`, mx, my + 18 * this.zoom);
      }
    }

    // 7. 다른 플레이어 아바타
    for (const player of otherPlayers) {
      this.drawScientistAvatar(player.x, player.y, player.name, player.color, player.team, false, 0);
    }

    // 8. 내 아바타 (최상단, 바운스 모션)
    this.drawScientistAvatar(myPlayer.x, myPlayer.y, `${myPlayer.name} (나)`, myPlayer.color, myPlayer.team, true, isMoving ? this.animTick : 0);
  }

  // 가스 가로등 은은한 밤안개 조명
  private renderGasLamps(ctx: CanvasRenderingContext2D) {
    const lampCoords: [number, number][] = [
      [350, 480], [510, 490], [670, 500], [500, 340], [510, 660], [330, 310]
    ];
    for (const [lx, ly] of lampCoords) {
      const [sx, sy] = this.worldToScreen(lx, ly);
      const rad = 50 * this.zoom;
      const lampGrad = ctx.createRadialGradient(sx, sy, 2 * this.zoom, sx, sy, rad);
      lampGrad.addColorStop(0, 'rgba(251, 191, 36, 0.35)'); // 따뜻한 가스등 노란 불빛
      lampGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = lampGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Fallback 고지도 렌더링
  private renderFallbackMap(ctx: CanvasRenderingContext2D, width: number, height: number) {
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
      ctx.strokeStyle = '#e6d8ba';
      ctx.lineWidth = (street.isMain ? 28 : 18) * this.zoom;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // 19세기 빅토리안 의사/과학자 정밀 아바타
  private drawScientistAvatar(wx: number, wy: number, name: string, coatColor: string, team: string, isMe: boolean, walkTick: number) {
    const [sx, sy] = this.worldToScreen(wx, wy);
    const ctx = this.ctx;
    const scale = this.zoom;

    const bounceY = Math.sin(walkTick * 4) * 2 * scale;
    const legSwing = Math.sin(walkTick * 4) * 4 * scale;

    ctx.save();
    ctx.translate(sx, sy + bounceY);

    // 하단 그림자
    ctx.beginPath();
    ctx.ellipse(0, 14 * scale, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();

    // 다리
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-4 * scale, 6 * scale);
    ctx.lineTo(-4 * scale + legSwing, 14 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4 * scale, 6 * scale);
    ctx.lineTo(4 * scale - legSwing, 14 * scale);
    ctx.stroke();

    // 롱코트
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.moveTo(-8 * scale, -6 * scale);
    ctx.lineTo(8 * scale, -6 * scale);
    ctx.lineTo(12 * scale, 11 * scale);
    ctx.lineTo(-12 * scale, 11 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isMe ? '#ffffff' : '#0f172a';
    ctx.lineWidth = isMe ? 2.5 : 1.5;
    ctx.stroke();

    // 하얀 크라바트 넥타이
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-3 * scale, -6 * scale);
    ctx.lineTo(0, 0);
    ctx.lineTo(3 * scale, -6 * scale);
    ctx.fill();

    // 얼굴
    ctx.beginPath();
    ctx.arc(0, -9 * scale, 6.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#fed7aa';
    ctx.fill();
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 실크햇 (Top Hat)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-11 * scale, -13 * scale, 22 * scale, 3 * scale); // 챙
    ctx.fillRect(-6.5 * scale, -24 * scale, 13 * scale, 11 * scale); // 몸통
    ctx.fillStyle = coatColor;
    ctx.fillRect(-6.5 * scale, -16 * scale, 13 * scale, 2.5 * scale); // 리본 띠

    // 오른손: 반짝이는 돋보기 (Magnifying glass)
    const glassX = 13 * scale;
    const glassY = -2 * scale;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(6 * scale, 2 * scale);
    ctx.lineTo(glassX, glassY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(glassX, glassY, 5.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // 돋보기 반사광
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.arc(glassX - 1.5 * scale, glassY - 1.5 * scale, 2.8 * scale, 0, Math.PI * 0.8);
    ctx.stroke();

    // 왼손: 가죽 왕진 가방
    const bagX = -12 * scale;
    const bagY = 2 * scale;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(bagX - 4 * scale, bagY, 8 * scale, 7 * scale);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeRect(bagX - 4 * scale, bagY, 8 * scale, 7 * scale);

    // 머리 위 이름표
    ctx.font = `bold ${Math.max(11, 12 * scale)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(name, 0, -28 * scale);

    ctx.restore();
  }
}
