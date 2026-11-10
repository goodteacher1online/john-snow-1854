import { SnowGameData, House, Pump, PlayerState, InvestigationRecord } from '../types.ts';
import { SOHO_STREETS, SOHO_BLOCKS } from '../data/streets.ts';

interface SmokeParticle {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
}

export class SohoMapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: SnowGameData;
  
  // 1854 실제 원본 고지도 이미지
  private mapImage: HTMLImageElement | null = null;
  private mapLoaded = false;

  // 카메라 뷰포트 (월드 크기: 2200 x 2200)
  public cameraX = 1100;
  public cameraY = 1100;
  public zoom = 1.15; // 더 넓고 쾌적한 기본 시야
  public targetZoom = 1.15;
  
  // 미아스마 안개 오버레이
  public showMiasmaFog = true;

  // 애니메이션 및 굴뚝 연기 파티클
  private animTick = 0;
  private smokeParticles: SmokeParticle[] = [];

  constructor(canvas: HTMLCanvasElement, data: SnowGameData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.data = data;
    this.loadAuthenticMap();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private loadAuthenticMap() {
    const img = new Image();
    img.src = './assets/snow_map.jpg';
    img.onload = () => {
      this.mapImage = img;
      this.mapLoaded = true;
    };
    img.onerror = () => {
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
    this.animTick += isMoving ? 0.22 : 0.06;

    // 카메라 추적
    this.cameraX += (myPlayer.x - this.cameraX) * 0.12;
    this.cameraY += (myPlayer.y - this.cameraY) * 0.12;
    this.zoom += (this.targetZoom - this.zoom) * 0.1;

    // 1. 2200 x 2200 광활한 1854 고지도 배경
    ctx.fillStyle = '#eddcb0';
    ctx.fillRect(0, 0, width, height);

    const WORLD_SIZE = 2200;
    const [originX, originY] = this.worldToScreen(0, 0);
    const mapW = WORLD_SIZE * this.zoom;
    const mapH = WORLD_SIZE * this.zoom;

    if (this.mapLoaded && this.mapImage) {
      ctx.save();
      ctx.drawImage(this.mapImage, originX, originY, mapW, mapH);

      // 고풍스러운 런던 거리 비네팅
      const vigGrad = ctx.createRadialGradient(
        originX + mapW / 2, originY + mapH / 2, mapW * 0.35,
        originX + mapW / 2, originY + mapH / 2, mapW * 0.65
      );
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(50, 30, 15, 0.45)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(originX, originY, mapW, mapH);
      ctx.restore();

      // 실제 고지도 도로 위 자갈길 톤(Cobblestone Tint) 시각화 (어디가 길인지 명확하게 구분!)
      this.renderCobblestoneStreets(ctx);
    } else {
      this.renderFallbackStreets(ctx);
    }

    // 2. 가로등 조명 효과 (밤안개 속 따뜻한 오렌지 불빛)
    this.renderGasLamps(ctx);

    // 3. 조사 진행 통계 (정답 유출 펄스 완전 삭제 - 데이터 기반 자기주도 탐구 보장)
    const investigatedCount = Object.keys(investigations).length;

    // 4. 입체적인 2.5D 빅토리안 건물 (Houses) 렌더링! (게임성 대폭 강화)
    for (const house of this.data.houses) {
      this.drawVictorian25DHouse(ctx, house, investigations, myPlayer);
    }

    // 굴뚝 연기 파티클 업데이트 및 렌더링
    this.updateAndDrawSmoke(ctx);

    // 5. 공공 식수 펌프 (Pumps)
    for (const pump of this.data.pumps) {
      this.drawVictorianPump(ctx, pump, broadHandleRemoved, myPlayer, investigatedCount);
    }

    // 6. 미아스마 악취 스모그 안개
    if (this.showMiasmaFog) {
      for (const m of this.data.miasmaMarkers) {
        const [mx, my] = this.worldToScreen(m.x, m.y);
        const fogR = (120 + Math.sin(this.animTick + m.x) * 15) * this.zoom;
        const grad = ctx.createRadialGradient(mx, my, 8 * this.zoom, mx, my, fogR);
        grad.addColorStop(0, 'rgba(70, 110, 25, 0.45)');
        grad.addColorStop(1, 'rgba(70, 110, 25, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, fogR, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `italic bold ${Math.max(11, 13 * this.zoom)}px serif`;
        ctx.fillStyle = '#1c2e0b';
        ctx.textAlign = 'center';
        ctx.fillText(`💨 ${m.name}`, mx, my + 20 * this.zoom);
      }
    }

    // 7. 다른 플레이어 과학자 아바타
    for (const player of otherPlayers) {
      this.drawScientistAvatar(player.x, player.y, player.name, player.color, player.team, false, 0);
    }

    // 8. 내 과학자 아바타
    this.drawScientistAvatar(myPlayer.x, myPlayer.y, `${myPlayer.name} (나)`, myPlayer.color, myPlayer.team, true, isMoving ? this.animTick : 0);
  }

  // ★ 2.5D 입체 빅토리안 건물 드로잉 (창문 불빛, 굴뚝 연기, 문패, 입체 지붕)
  private drawVictorian25DHouse(
    ctx: CanvasRenderingContext2D,
    house: House,
    investigations: Record<string, InvestigationRecord>,
    myPlayer: PlayerState
  ) {
    const [hx, hy] = this.worldToScreen(house.x, house.y);
    const isInvestigated = !!investigations[house.id];
    const distToPlayer = Math.hypot(house.x - myPlayer.x, house.y - myPlayer.y);
    const scale = this.zoom;
    const isBrewery = house.id === 'house_15';
    const isWorkhouse = house.id === 'house_16';

    // 1854 빅토리안 건축 고증 규격 (양조장/구빈원/테라스하우스)
    const w = (isBrewery ? 52 : isWorkhouse ? 58 : 38) * scale;
    const h = (isBrewery ? 30 : isWorkhouse ? 32 : 28) * scale;
    const roofH = (isBrewery ? 12 : isWorkhouse ? 14 : 16) * scale;

    ctx.save();
    ctx.translate(hx, hy);

    // 1. 건물 바닥 그림자
    ctx.beginPath();
    ctx.ellipse(w * 0.08, h * 0.32, w * 0.62, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();

    // 2. 파사드 벽체 (건축 양식별 고증 색상)
    if (isBrewery) {
      // 라이온 양조장: 짙은 적벽돌 공장 외벽
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      // 양조장 맥주통(Barrels) 3개 나열
      const barrelR = 4 * scale;
      [-16 * scale, -6 * scale, 4 * scale].forEach(bx => {
        ctx.beginPath();
        ctx.ellipse(bx, h / 2 - 2 * scale, barrelR * 1.2, barrelR, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#78350f';
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1 * scale;
        ctx.stroke();
      });

      // 대형 아치 문
      ctx.beginPath();
      ctx.arc(14 * scale, h / 2 - 8 * scale, 7 * scale, Math.PI, 0);
      ctx.fillStyle = '#1c1917';
      ctx.fill();

      // 양조장 높은 산업용 벽돌 굴뚝
      const chimX = -18 * scale;
      const chimY = -h / 2 - 20 * scale;
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(chimX - 3 * scale, chimY, 7 * scale, 24 * scale);
      if (Math.random() < 0.12) {
        this.smokeParticles.push({
          x: hx + chimX,
          y: hy + chimY,
          life: 0,
          maxLife: 45 + Math.random() * 25,
          size: (4 + Math.random() * 4) * scale
        });
      }
    } else if (isWorkhouse) {
      // 세인트 제임스 구빈원: 육중한 런던 화강암 석조 파사드
      ctx.fillStyle = '#475569';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.2 * scale;
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      // 규칙적인 3열 촘촘한 수직 격자창
      const winW = 4.5 * scale;
      const winH = 6 * scale;
      [-18 * scale, 0, 18 * scale].forEach(wx => {
        // 2층 창
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(wx - winW / 2, -h / 2 + 3 * scale, winW, winH);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(wx - winW / 2 + 0.8 * scale, -h / 2 + 3.8 * scale, winW - 1.6 * scale, winH - 1.6 * scale);
        // 1층 창
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(wx - winW / 2, -h / 2 + 13 * scale, winW, winH);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(wx - winW / 2 + 0.8 * scale, -h / 2 + 13.8 * scale, winW - 1.6 * scale, winH - 1.6 * scale);
      });

      // 엄숙한 철제 정문
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-5 * scale, h / 2 - 10 * scale, 10 * scale, 10 * scale);
    } else {
      // 빅토리안 테라스 하우스 (런던 스톡 브릭 & 흑철제 난간)
      const brickColor = (house.deaths % 2 === 0) ? '#a36a4f' : '#94523c';
      ctx.fillStyle = brickColor;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 1.8 * scale;
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      // 맨사드 슬레이트 박공 지붕
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 2 * scale, -h / 2);
      ctx.lineTo(0, -h / 2 - roofH);
      ctx.lineTo(w / 2 + 2 * scale, -h / 2);
      ctx.closePath();
      ctx.fillStyle = '#334155'; // 슬레이트 블루그레이
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8 * scale;
      ctx.stroke();

      // 굴뚝 2구 테라코타 포트
      const cx = w * 0.22;
      const cy = -h / 2 - roofH * 0.65;
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(cx - 3 * scale, cy - 7 * scale, 6 * scale, 9 * scale);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(cx - 2.5 * scale, cy - 9 * scale, 2 * scale, 2.5 * scale);
      ctx.fillRect(cx + 0.5 * scale, cy - 9 * scale, 2 * scale, 2.5 * scale);

      if (Math.random() < 0.08) {
        this.smokeParticles.push({
          x: hx + cx,
          y: hy + cy - 9 * scale,
          life: 0,
          maxLife: 35 + Math.random() * 20,
          size: (3 + Math.random() * 2.5) * scale
        });
      }

      // 흰색 상인방(Lintel) 격자 슬라이딩 창 (Sash Windows)
      const winW = 6.5 * scale;
      const winH = 8 * scale;
      [-w * 0.26, w * 0.26].forEach((wx) => {
        // 흰색 창틀
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(wx - winW / 2 - 0.8 * scale, -h / 2 + 3 * scale, winW + 1.6 * scale, winH + 1.2 * scale);
        // 유리창 (따뜻한 호박색 불빛)
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(wx - winW / 2, -h / 2 + 3.8 * scale, winW, winH);
        // 4칸 격자
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 0.8 * scale;
        ctx.beginPath();
        ctx.moveTo(wx, -h / 2 + 3.8 * scale);
        ctx.lineTo(wx, -h / 2 + 3.8 * scale + winH);
        ctx.moveTo(wx - winW / 2, -h / 2 + 3.8 * scale + winH / 2);
        ctx.lineTo(wx + winW / 2, -h / 2 + 3.8 * scale + winH / 2);
        ctx.stroke();
      });

      // 아치형 목재 현관문
      const doorW = 7.5 * scale;
      const doorH = 11 * scale;
      ctx.fillStyle = '#3e1c0c';
      ctx.fillRect(-doorW / 2, h / 2 - doorH, doorW, doorH);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-doorW / 2 + 1.8 * scale, h / 2 - doorH * 0.5, 1.4 * scale, 1.4 * scale); // 황동 손잡이

      // 흑철제 난간 (Area Railings)
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.moveTo(-w / 2, h / 2);
      ctx.lineTo(-doorW / 2 - 1 * scale, h / 2);
      ctx.moveTo(doorW / 2 + 1 * scale, h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.stroke();
    }

    // 3. ★ [존 스노우 1854 원본 고증] 조사 완료 시 검은 사망자 막대탑(Death Bars) 스택 렌더링!
    if (isInvestigated) {
      if (house.deaths > 0) {
        // 사망자 수만큼 차곡차곡 쌓이는 검은색 잉크 막대 (스노우 원본 지도 방식)
        const barW = 16 * scale;
        const barH = 3.6 * scale;
        const barGap = 1.2 * scale;
        const startY = -h / 2 - roofH - 4 * scale;

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1 * scale;

        for (let i = 0; i < house.deaths; i++) {
          const by = startY - i * (barH + barGap);
          ctx.fillRect(-barW / 2, by, barW, barH);
          ctx.strokeRect(-barW / 2, by, barW, barH);
        }

        // 막대탑 최상단 사망자 수 뱃지
        const badgeY = startY - house.deaths * (barH + barGap) - 7 * scale;
        ctx.beginPath();
        ctx.arc(0, badgeY, 7.5 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#b91c1c';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        ctx.font = `bold ${Math.max(9, 10 * scale)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(house.deaths), 0, badgeY);
      } else {
        // 사망 0명 이상치 (양조장, 딘 가 21번지 등) : 녹색 방패 뱃지
        const badgeY = -h / 2 - roofH - 8 * scale;
        ctx.beginPath();
        ctx.arc(0, badgeY, 9 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#15803d';
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        ctx.font = `bold ${Math.max(9, 10 * scale)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("0", 0, badgeY);
      }
    }

    // 4. 가구 접근 시 황금빛 펄스 링 & 머리 위 3D 뱃지
    if (distToPlayer < 65) {
      const pulse = (Math.sin(this.animTick * 2.8) + 1) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, (w * 0.72 + pulse * 18) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245, 158, 11, ${1 - pulse * 0.5})`;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // 머리 위 3D 조사 뱃지
      ctx.save();
      const topOffset = isInvestigated && house.deaths > 0 
        ? -h / 2 - roofH - (house.deaths * 4.8 + 26) * scale 
        : -h / 2 - roofH - 16 * scale;
      ctx.translate(0, topOffset);

      ctx.fillStyle = isInvestigated ? '#15803d' : '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(-32 * scale, -14 * scale, 64 * scale, 28 * scale, 7 * scale);
      ctx.fill();
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();

      ctx.font = `900 ${Math.max(12, 13 * scale)}px sans-serif`;
      ctx.fillStyle = isInvestigated ? '#ffffff' : '#0c0a09';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isInvestigated ? "확인 [E]" : "조사 [E]", 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  // 굴뚝 연기 파티클
  private updateAndDrawSmoke(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life++;
      p.y -= 0.6;
      p.x += Math.sin(p.life * 0.1) * 0.3;

      const alpha = (1 - p.life / p.maxLife) * 0.35;
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + p.life * 0.03), 0, Math.PI * 2);
      ctx.fill();

      if (p.life >= p.maxLife) {
        this.smokeParticles.splice(i, 1);
      }
    }
    ctx.restore();
  }

  // 빅토리안 무쇠 펌프 드로잉 (★ 모든 8개 펌프 외형 100% 동일화 - 정답 유출 방지!)
  private drawVictorianPump(
    ctx: CanvasRenderingContext2D,
    pump: Pump,
    broadHandleRemoved: boolean,
    myPlayer: PlayerState,
    investigatedCount: number
  ) {
    const [px, py] = this.worldToScreen(pump.x, pump.y);
    const scale = this.zoom;

    ctx.save();
    ctx.translate(px, py);

    // 원형 화강암 석재 기단 (모든 펌프 동일)
    ctx.beginPath();
    ctx.arc(0, 0, 14 * scale, 0, Math.PI * 2);
    ctx.fillStyle = broadHandleRemoved && pump.isSource ? '#475569' : '#64748b';
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3 * scale;
    ctx.stroke();

    // 무쇠 펌프 기둥 (모든 펌프 동일한 짙은 슬레이트 블랙)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-4 * scale, -15 * scale, 8 * scale, 20 * scale);

    // 주물 손잡이
    if (!pump.isSource || !broadHandleRemoved) {
      ctx.beginPath();
      ctx.moveTo(0, -11 * scale);
      ctx.lineTo(14 * scale, -3 * scale);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
    }

    // 주둥이 (Spout)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-8 * scale, -4 * scale, 5 * scale, 4 * scale);

    // 펌프 이름 명판 (동일한 슬레이트 그레이)
    ctx.font = `bold ${Math.max(11, 13 * scale)}px 'Georgia', serif`;
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    const label = pump.name + (pump.isSource && broadHandleRemoved ? " [손잡이 분리됨]" : "");
    ctx.fillText(label, 0, 26 * scale);

    // 펌프 앞 접근 시 안내 (브로드 펌프 특혜 표시 완전 삭제)
    const dist = Math.hypot(pump.x - myPlayer.x, pump.y - myPlayer.y);
    if (dist < 55) {
      if (pump.isSource && !broadHandleRemoved && investigatedCount >= 8) {
        // 충분한 데이터가 모였을 때만 결단 뱃지 표시
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(-80 * scale, -48 * scale, 160 * scale, 30 * scale, 8 * scale);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
        ctx.font = `900 ${Math.max(12, 14 * scale)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText("손잡이 분리 [Space]", 0, -29 * scale);
      }
    }

    ctx.restore();
  }

  // 가스등 조명
  private renderGasLamps(ctx: CanvasRenderingContext2D) {
    const lampCoords: [number, number][] = [
      [770, 1060], [1120, 1080], [1500, 1100], [1100, 750], [1120, 1450], [730, 680]
    ];
    for (const [lx, ly] of lampCoords) {
      const [sx, sy] = this.worldToScreen(lx, ly);
      const rad = 80 * this.zoom;
      const lampGrad = ctx.createRadialGradient(sx, sy, 4 * this.zoom, sx, sy, rad);
      lampGrad.addColorStop(0, 'rgba(251, 191, 36, 0.38)');
      lampGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = lampGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 실제 고지도 도로 위 자갈길 톤(Cobblestone Tint) 시각화 (길인 곳을 명확히 구분!)
  private renderCobblestoneStreets(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const street of SOHO_STREETS) {
      if (street.points.length < 2) continue;
      ctx.beginPath();
      const [startWx, startWy] = street.points[0];
      const [startSx, startSy] = this.worldToScreen(startWx, startWy);
      ctx.moveTo(startSx, startSy);
      for (let i = 1; i < street.points.length; i++) {
        const [wx, wy] = street.points[i];
        const [sx, sy] = this.worldToScreen(wx, wy);
        ctx.lineTo(sx, sy);
      }
      // 따뜻하고 밝은 런던 자갈길 반투명 톤
      ctx.strokeStyle = 'rgba(255, 248, 230, 0.45)';
      ctx.lineWidth = ((street.width || 56) * 1.35) * this.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 길 가장자리 인도 연석선 (Curb Lines)
      ctx.strokeStyle = 'rgba(120, 113, 108, 0.35)';
      ctx.lineWidth = 2 * this.zoom;
      ctx.setLineDash([10 * this.zoom, 14 * this.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private renderFallbackStreets(ctx: CanvasRenderingContext2D) {
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
      ctx.lineWidth = (street.isMain ? 65 : 45) * this.zoom;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // ★ [핵심 혁신] 레고(LEGO®) 미니피규어 빅토리안 과학자 아바타!
  private drawScientistAvatar(wx: number, wy: number, name: string, coatColor: string, team: string, isMe: boolean, walkTick: number) {
    const [sx, sy] = this.worldToScreen(wx, wy);
    const ctx = this.ctx;
    const scale = this.zoom;

    // 레고 특유의 뻣뻣하고 절도 있는 타닥타닥 보행 애니메이션
    const bounceY = Math.abs(Math.sin(walkTick * 4)) * -2.5 * scale;
    const legSwing = Math.sin(walkTick * 4) * 6 * scale;

    ctx.save();
    ctx.translate(sx, sy + bounceY);

    // 1. 바닥 그림자 (레고 둥근 타원)
    ctx.beginPath();
    ctx.ellipse(0, 16 * scale, 15 * scale, 6.5 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // 2. 레고 다리 (직사각형 2분할 레고 하체)
    const legW = 6.5 * scale;
    const legH = 11 * scale;
    // 왼쪽 다리
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-7.5 * scale, 5 * scale + legSwing, legW, legH);
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.2 * scale;
    ctx.strokeRect(-7.5 * scale, 5 * scale + legSwing, legW, legH);
    // 레고 왼쪽 발가락 스터드 턱
    ctx.fillRect(-7.5 * scale, 13 * scale + legSwing, legW, 3 * scale);

    // 오른쪽 다리
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(1 * scale, 5 * scale - legSwing, legW, legH);
    ctx.strokeRect(1 * scale, 5 * scale - legSwing, legW, legH);
    // 레고 오른쪽 발가락 스터드 턱
    ctx.fillRect(1 * scale, 13 * scale - legSwing, legW, 3 * scale);

    // 골반 힙 바 (Hips)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-8.5 * scale, 2.5 * scale, 17 * scale, 3.5 * scale);

    // 3. 레고 사다리꼴 몸통 (Torso)
    ctx.beginPath();
    ctx.moveTo(-7 * scale, -13 * scale); // 어깨 왼쪽
    ctx.lineTo(7 * scale, -13 * scale);  // 어깨 오른쪽
    ctx.lineTo(8.5 * scale, 2.5 * scale); // 허리 오른쪽
    ctx.lineTo(-8.5 * scale, 2.5 * scale); // 허리 왼쪽
    ctx.closePath();
    ctx.fillStyle = coatColor;
    ctx.fill();
    ctx.strokeStyle = isMe ? '#ffffff' : '#0f172a';
    ctx.lineWidth = isMe ? 2.8 * scale : 1.5 * scale;
    ctx.stroke();

    // 토르소 빅토리안 수트 프린팅 (흰 셔츠 V넥 + 검은 보타이 + 단추)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-3 * scale, -13 * scale);
    ctx.lineTo(0, -6 * scale);
    ctx.lineTo(3 * scale, -13 * scale);
    ctx.closePath();
    ctx.fill();

    // 나비넥타이 (Bowtie)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-2.5 * scale, -11 * scale);
    ctx.lineTo(2.5 * scale, -9 * scale);
    ctx.lineTo(2.5 * scale, -11 * scale);
    ctx.lineTo(-2.5 * scale, -9 * scale);
    ctx.closePath();
    ctx.fill();

    // 황동 단추 2개
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -3 * scale, 0.9 * scale, 0, Math.PI * 2);
    ctx.arc(0, -0.5 * scale, 0.9 * scale, 0, Math.PI * 2);
    ctx.fill();

    // 4. 레고 팔과 상징적인 노란색 ㄷ자 집게손 (Claw Hands)
    // 왼쪽 팔 & 손
    ctx.fillStyle = coatColor;
    ctx.fillRect(-11 * scale, -12 * scale, 3.5 * scale, 9 * scale);
    // 왼쪽 노란색 ㄷ자 손
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.arc(-9.5 * scale, 0 * scale, 3.5 * scale, Math.PI * 0.25, Math.PI * 1.75);
    ctx.stroke();

    // 오른쪽 팔 & 손 (돋보기 쥐고 있음)
    ctx.fillStyle = coatColor;
    ctx.fillRect(7.5 * scale, -12 * scale, 3.5 * scale, 9 * scale);
    // 오른쪽 노란색 ㄷ자 손
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.arc(9.5 * scale, 0 * scale, 3.5 * scale, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.stroke();

    // 레고 황동 돋보기 장착!
    const glassX = 16 * scale;
    const glassY = -4 * scale;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    ctx.moveTo(9.5 * scale, 0);
    ctx.lineTo(glassX, glassY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(glassX, glassY, 6.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    // 돋보기 반사광
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.arc(glassX - 2 * scale, glassY - 2 * scale, 3.2 * scale, 0, Math.PI * 0.7);
    ctx.stroke();

    // 5. 레고 노란색 원통 머리 (Lego Head)
    const headW = 12 * scale;
    const headH = 10 * scale;
    const headY = -23 * scale;

    // 머리 위 레고 스터드 (Lego Stud)
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-3 * scale, headY - 3 * scale, 6 * scale, 3.2 * scale);
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(-3 * scale, headY - 3 * scale, 6 * scale, 3.2 * scale);

    // 얼굴 원통 (노란색)
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(-headW / 2, headY, headW, headH, 3 * scale);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();

    // 땡그란 레고 눈 2개 (검은 눈 + 흰색 반사 하이라이트)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-2.6 * scale, headY + 4 * scale, 1.4 * scale, 0, Math.PI * 2);
    ctx.arc(2.6 * scale, headY + 4 * scale, 1.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    // 눈동자 흰색 반사 하이라이트
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2.2 * scale, headY + 3.5 * scale, 0.5 * scale, 0, Math.PI * 2);
    ctx.arc(3 * scale, headY + 3.5 * scale, 0.5 * scale, 0, Math.PI * 2);
    ctx.fill();

    // 귀여운 레고 미소 입
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.arc(0, headY + 5.2 * scale, 2.5 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // 6. 레고 빅토리안 실크햇 / 중절모 몰드
    const hatY = headY - 5 * scale;
    // 둥근 챙
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, hatY + 4 * scale, 12 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();
    // 모자 크라운 본체
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-6.5 * scale, hatY - 8 * scale, 13 * scale, 11 * scale, 2.5 * scale);
    ctx.fill();
    // 모자 팀 컬러 밴드
    ctx.fillStyle = coatColor;
    ctx.fillRect(-6.5 * scale, hatY + 0.5 * scale, 13 * scale, 2.8 * scale);

    // 7. 초대형 고가독성 명찰 라벨
    ctx.font = `900 ${Math.max(13, 14 * scale)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    // 흰색 두꺼운 텍스트 그림자
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 3.5 * scale;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(name, 0, headY - 14 * scale);
    ctx.fillText(name, 0, headY - 14 * scale);
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}
