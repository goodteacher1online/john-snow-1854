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
    } else {
      this.renderFallbackStreets(ctx);
    }

    // 2. 가로등 조명 효과 (밤안개 속 따뜻한 오렌지 불빛)
    this.renderGasLamps(ctx);

    // 3. 브로드 펌프 감염 동심원 파동
    const investigatedCount = Object.keys(investigations).length;
    if (investigatedCount > 0) {
      const broadPump = this.data.pumps.find(p => p.isSource);
      if (broadPump) {
        const [bx, by] = this.worldToScreen(broadPump.x, broadPump.y);
        const radius = Math.min(380, (100 + investigatedCount * 14)) * this.zoom;
        const heatGrad = ctx.createRadialGradient(bx, by, 15 * this.zoom, bx, by, radius);
        heatGrad.addColorStop(0, 'rgba(185, 28, 28, 0.38)');
        heatGrad.addColorStop(0.5, 'rgba(220, 38, 38, 0.16)');
        heatGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = heatGrad;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(185, 28, 28, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(bx, by, radius * (0.88 + Math.sin(this.animTick * 0.5) * 0.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

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

    const w = 36 * scale;
    const h = 26 * scale;
    const roofH = 18 * scale;

    ctx.save();
    ctx.translate(hx, hy);

    if (isInvestigated) {
      // [조사 완료] 역학 점 표기 (사망자 수에 비례)
      if (house.deaths > 0) {
        const dotR = Math.min(28, (7 + house.deaths * 2.8) * scale);
        ctx.beginPath();
        ctx.arc(0, 0, dotR, 0, Math.PI * 2);
        ctx.fillStyle = '#b91c1c';
        ctx.fill();
        ctx.strokeStyle = '#450a0a';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = `900 ${Math.max(12, 14 * scale)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(house.deaths), 0, 0);
      } else {
        // 이상치 (사망 0명): 황금 테두리 녹색 방패
        ctx.beginPath();
        ctx.arc(0, 0, 15 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#15803d';
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = `900 ${Math.max(11, 13 * scale)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("0", 0, 0);
      }
    } else {
      // [미조사 가구] 정교한 2.5D 빅토리안 하우스

      // 건물 바닥 그림자
      ctx.beginPath();
      ctx.ellipse(w * 0.1, h * 0.3, w * 0.65, h * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();

      // 건물 벽체 (벽돌 붉은 갈색)
      ctx.fillStyle = '#854d27';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#3e1f0d';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      // 입체 삼각형 슬레이트 지붕
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 2, -h / 2);
      ctx.lineTo(0, -h / 2 - roofH);
      ctx.lineTo(w / 2 + 2, -h / 2);
      ctx.closePath();
      ctx.fillStyle = '#5c2d16'; // 짙은 지붕 타일
      ctx.fill();
      ctx.strokeStyle = '#2b1206';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 굴뚝 & 연기 발생 지점
      const chimneyX = w * 0.25;
      const chimneyY = -h / 2 - roofH * 0.7;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(chimneyX - 2 * scale, chimneyY - 8 * scale, 5 * scale, 10 * scale);

      if (Math.random() < 0.08) {
        this.smokeParticles.push({
          x: hx + chimneyX,
          y: hy + chimneyY - 8 * scale,
          life: 0,
          maxLife: 40 + Math.random() * 20,
          size: (3 + Math.random() * 3) * scale
        });
      }

      // 창문 2개 (노란 가스등 불빛)
      const winW = 6 * scale;
      const winH = 8 * scale;
      [-w * 0.25, w * 0.25].forEach((wx) => {
        ctx.fillStyle = '#fef08a'; // 창문 따뜻한 불빛
        ctx.fillRect(wx - winW / 2, -h / 2 + 4 * scale, winW, winH);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1;
        ctx.strokeRect(wx - winW / 2, -h / 2 + 4 * scale, winW, winH);
      });

      // 중앙 현관문 & 황동 손잡이
      const doorW = 8 * scale;
      const doorH = 12 * scale;
      ctx.fillStyle = '#3e1c0c';
      ctx.fillRect(-doorW / 2, h / 2 - doorH, doorW, doorH);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-doorW / 2 + 2 * scale, h / 2 - doorH * 0.5, 1.5 * scale, 1.5 * scale); // 손잡이

      // ★ [핵심] 가구 접근 시 큼직한 황금빛 펄스 링 & 머리 위 3D 뱃지
      if (distToPlayer < 65) {
        const pulse = (Math.sin(this.animTick * 2.8) + 1) / 2;
        ctx.beginPath();
        ctx.arc(0, 0, (w * 0.75 + pulse * 18) * scale, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${1 - pulse * 0.5})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // 머리 위 3D [E] 조사 뱃지
        ctx.save();
        ctx.translate(0, -h / 2 - roofH - 14 * scale);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(-30 * scale, -15 * scale, 60 * scale, 30 * scale, 8 * scale);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.font = `900 ${Math.max(13, 15 * scale)}px -apple-system, sans-serif`;
        ctx.fillStyle = '#0c0a09';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("조사 [E]", 0, 0);
        ctx.restore();
      }
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

  // 빅토리안 무쇠 펌프 드로잉
  private drawVictorianPump(
    ctx: CanvasRenderingContext2D,
    pump: Pump,
    broadHandleRemoved: boolean,
    myPlayer: PlayerState,
    investigatedCount: number
  ) {
    const [px, py] = this.worldToScreen(pump.x, pump.y);
    const isBroad = pump.isSource;
    const scale = this.zoom;

    ctx.save();
    ctx.translate(px, py);

    // 원형 석재 기단
    ctx.beginPath();
    ctx.arc(0, 0, (isBroad ? 22 : 14) * scale, 0, Math.PI * 2);
    ctx.fillStyle = isBroad ? (broadHandleRemoved ? '#475569' : '#0284c7') : '#334155';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5 * scale;
    ctx.stroke();

    // 무쇠 펌프 기둥
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-4 * scale, -15 * scale, 8 * scale, 20 * scale);

    // 주물 손잡이
    if (!isBroad || !broadHandleRemoved) {
      ctx.beginPath();
      ctx.moveTo(0, -11 * scale);
      ctx.lineTo(15 * scale, -3 * scale);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3.5 * scale;
      ctx.stroke();
    }

    // 펌프 이름 명판
    ctx.font = `bold ${Math.max(12, 14 * scale)}px 'Georgia', serif`;
    ctx.fillStyle = isBroad ? '#0369a1' : '#1e293b';
    ctx.textAlign = 'center';
    const label = pump.name + (isBroad && broadHandleRemoved ? " [손잡이 제거됨!]" : "");
    ctx.fillText(label, 0, 28 * scale);

    // 브로드 펌프 손잡이 제거 인터랙션 (8개 이상 조사 시 잠금 해제)
    if (isBroad && !broadHandleRemoved) {
      const dist = Math.hypot(pump.x - myPlayer.x, pump.y - myPlayer.y);
      if (dist < 65) {
        if (investigatedCount >= 8) {
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.roundRect(-80 * scale, -52 * scale, 160 * scale, 32 * scale, 10 * scale);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.font = `900 ${Math.max(13, 15 * scale)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText("손잡이 제거 [Space]", 0, -31 * scale);
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          ctx.beginPath();
          ctx.roundRect(-85 * scale, -45 * scale, 170 * scale, 26 * scale, 8 * scale);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.font = `bold ${Math.max(11, 12 * scale)}px sans-serif`;
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(`증거 데이터 필요 (${investigatedCount}/8)`, 0, -28 * scale);
        }
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
      ctx.lineWidth = (street.isMain ? 45 : 30) * this.zoom;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // 19세기 과학자 아바타
  private drawScientistAvatar(wx: number, wy: number, name: string, coatColor: string, team: string, isMe: boolean, walkTick: number) {
    const [sx, sy] = this.worldToScreen(wx, wy);
    const ctx = this.ctx;
    const scale = this.zoom;

    const bounceY = Math.sin(walkTick * 4) * 2.5 * scale;
    const legSwing = Math.sin(walkTick * 4) * 4.5 * scale;

    ctx.save();
    ctx.translate(sx, sy + bounceY);

    // 그림자
    ctx.beginPath();
    ctx.ellipse(0, 16 * scale, 14 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // 다리
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(-5 * scale, 7 * scale);
    ctx.lineTo(-5 * scale + legSwing, 16 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5 * scale, 7 * scale);
    ctx.lineTo(5 * scale - legSwing, 16 * scale);
    ctx.stroke();

    // 롱코트
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, -7 * scale);
    ctx.lineTo(10 * scale, -7 * scale);
    ctx.lineTo(14 * scale, 12 * scale);
    ctx.lineTo(-14 * scale, 12 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isMe ? '#ffffff' : '#0f172a';
    ctx.lineWidth = isMe ? 3 : 1.8;
    ctx.stroke();

    // 넥타이
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-3 * scale, -7 * scale);
    ctx.lineTo(0, 0);
    ctx.lineTo(3 * scale, -7 * scale);
    ctx.fill();

    // 얼굴
    ctx.beginPath();
    ctx.arc(0, -10 * scale, 7.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#fed7aa';
    ctx.fill();
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 실크햇
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-13 * scale, -15 * scale, 26 * scale, 3.5 * scale);
    ctx.fillRect(-7.5 * scale, -28 * scale, 15 * scale, 13 * scale);
    ctx.fillStyle = coatColor;
    ctx.fillRect(-7.5 * scale, -18 * scale, 15 * scale, 3 * scale);

    // 돋보기
    const glassX = 15 * scale;
    const glassY = -2 * scale;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(7 * scale, 2 * scale);
    ctx.lineTo(glassX, glassY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(glassX, glassY, 6.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.75)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();

    // 돋보기 반사광
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.arc(glassX - 1.8 * scale, glassY - 1.8 * scale, 3.2 * scale, 0, Math.PI * 0.8);
    ctx.stroke();

    // 가방
    const bagX = -14 * scale;
    const bagY = 2 * scale;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(bagX - 5 * scale, bagY, 10 * scale, 8 * scale);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.8 * scale;
    ctx.strokeRect(bagX - 5 * scale, bagY, 10 * scale, 8 * scale);

    // 명찰
    ctx.font = `bold ${Math.max(12, 13 * scale)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(name, 0, -32 * scale);

    ctx.restore();
  }
}
