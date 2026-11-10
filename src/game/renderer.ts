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

  // 1854 빅토리안 실사 건물 스프라이트 이미지
  private houseTerraceImg: HTMLImageElement | null = null;
  private houseBreweryImg: HTMLImageElement | null = null;
  private houseWorkhouseImg: HTMLImageElement | null = null;

  // 1854 빅토리안 주물 무쇠 펌프 스프라이트 이미지
  private pumpImg: HTMLImageElement | null = null;
  private pumpNoHandleImg: HTMLImageElement | null = null;

  // 1854 빅토리안 2D 실사 캐릭터 전신 스프라이트 이미지
  private charMaleImg: HTMLImageElement | null = null;
  private charFemaleImg: HTMLImageElement | null = null;

  // 카메라 뷰포트 (월드 크기: 2200 x 2064 - 고지도 1280x1201 정밀 1:1 스케일)
  public cameraX = 1234;
  public cameraY = 944;
  public zoom = 2.4; // ★ [요청 반영] 지도 2.4배 대폭 확대! 집들이 절대 겹치지 않고 골목길이 시원하게 펼쳐짐
  public targetZoom = 2.4;
  
  // 미아스마 안개 오버레이
  public showMiasmaFog = true;

  // 1854 존 스노우 원본 보로노이(Voronoi / Thiessen) 도보권역 시각화 토글
  public showVoronoi = false;

  // 가스등 조명 온/오프
  public showGasLamps = true;

  // 교실 대형 스크린(전자칠판) 전체 관제 모드
  public isBigScreenMode = false;

  // 애니메이션 및 굴뚝 연기 파티클
  private animTick = 0;
  private smokeParticles: SmokeParticle[] = [];

  constructor(canvas: HTMLCanvasElement, data: SnowGameData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.data = data;
    this.loadAuthenticMap();
    this.loadHouseSprites();
    this.loadPumpSprites();
    this.loadCharacterSprites();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // 마우스 휠 줌 인/아웃 지원 (1.4배 ~ 3.5배 자유 시야)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * -0.0018;
      this.targetZoom = Math.max(1.4, Math.min(3.6, this.targetZoom + zoomDelta));
    }, { passive: false });
  }

  private loadCharacterSprites() {
    this.charMaleImg = new Image();
    this.charMaleImg.src = './assets/characters/player_male.png';
    this.charFemaleImg = new Image();
    this.charFemaleImg.src = './assets/characters/player_female.png';
  }

  private loadHouseSprites() {
    this.houseTerraceImg = new Image();
    this.houseTerraceImg.src = './assets/houses/house_terrace.png';
    this.houseBreweryImg = new Image();
    this.houseBreweryImg.src = './assets/houses/house_brewery.png';
    this.houseWorkhouseImg = new Image();
    this.houseWorkhouseImg.src = './assets/houses/house_workhouse.png';
  }

  private loadPumpSprites() {
    this.pumpImg = new Image();
    this.pumpImg.src = './assets/pump_cast_iron.png';
    this.pumpNoHandleImg = new Image();
    this.pumpNoHandleImg.src = './assets/pump_cast_iron_no_handle.png';
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
    broadHandleRemoved: boolean,
    isMoving: boolean,
    targetDest: { x: number; y: number } | null = null
  ) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.animTick += isMoving ? 0.22 : 0.06;

    // 카메라 추적 (대형 스크린 모드 시 전체 소호 전경 조망)
    if (this.isBigScreenMode) {
      this.cameraX += (1100 - this.cameraX) * 0.08;
      this.cameraY += (1100 - this.cameraY) * 0.08;
      this.zoom += (0.52 - this.zoom) * 0.08;
    } else {
      this.cameraX += (myPlayer.x - this.cameraX) * 0.12;
      this.cameraY += (myPlayer.y - this.cameraY) * 0.12;
      this.zoom += (this.targetZoom - this.zoom) * 0.1;
    }

    // 1. 2200 x 2064 광활한 1854 고지도 배경 (1280x1201 x 1.71875 정밀 종횡비 보정)
    ctx.fillStyle = '#eddcb0';
    ctx.fillRect(0, 0, width, height);

    const WORLD_WIDTH = 2200;
    const WORLD_HEIGHT = 2064;
    const [originX, originY] = this.worldToScreen(0, 0);
    const mapW = WORLD_WIDTH * this.zoom;
    const mapH = WORLD_HEIGHT * this.zoom;

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

    // 1.5 1854 존 스노우 원본 보로노이(Voronoi/Thiessen Polygon) 보행권역 오버레이
    if (this.showVoronoi) {
      this.renderVoronoiOverlay(ctx);
    }

    // 2. 가로등 조명 효과 (밤안개 속 따뜻한 오렌지 불빛)
    if (this.showGasLamps) {
      this.renderGasLamps(ctx);
    }

    // 3. 조사 진행 통계 (정답 유출 펄스 완전 삭제 - 데이터 기반 자기주도 탐구 보장)
    const investigatedCount = Object.keys(investigations).length;

    // 4. 입체적인 2.5D 빅토리안 건물 (Houses) 렌더링! (게임성 대폭 강화)
    for (const house of this.data.houses) {
      this.drawVictorian25DHouse(ctx, house, investigations, myPlayer);
    }

    // 굴뚝 연기 파티클 업데이트 및 렌더링
    this.updateAndDrawSmoke(ctx);

    // 마우스 클릭 이동 목적지 마커 (앤틱 황금빛 펄스 링)
    if (targetDest) {
      const [tx, ty] = this.worldToScreen(targetDest.x, targetDest.y);
      const pulse = (Math.sin(this.animTick * 6) + 1) * 0.5;
      const radius = (10 + pulse * 5) * this.zoom;
      ctx.save();
      ctx.beginPath();
      ctx.arc(tx, ty, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 * this.zoom;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(tx, ty, 3 * this.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#d97706';
      ctx.fill();
      ctx.restore();
    }

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
      this.drawScientistAvatar(
        player.x, player.y, player.name, player.color, player.team,
        false, 0, player.hatStyle, player.toolStyle, player.gender
      );
    }

    // 8. 내 과학자 아바타
    this.drawScientistAvatar(
      myPlayer.x, myPlayer.y, `${myPlayer.name} (나)`, myPlayer.color, myPlayer.team,
      true, isMoving ? this.animTick : 0, myPlayer.hatStyle, myPlayer.toolStyle, myPlayer.gender
    );
  }

  // ★ 1854 존 스노우 원본 보로노이(Voronoi/Thiessen Polygon) 보행 최단거리 권역 시각화!
  private renderVoronoiOverlay(ctx: CanvasRenderingContext2D) {
    const VORONOI_CELLS = [
      {
        id: 'cell_broad',
        name: '브로드 가 펌프 보행권역 (사망자 90% 밀집)',
        isBroad: true,
        points: [[880, 830], [1210, 790], [1320, 1020], [1320, 1280], [1180, 1370], [890, 1300], [820, 1030]]
      },
      {
        id: 'cell_great_marlborough',
        name: '그레이트 말버러 권역',
        isBroad: false,
        points: [[880, 400], [1350, 400], [1210, 790], [880, 830]]
      },
      {
        id: 'cell_little_marlborough',
        name: '리틀 말버러 권역',
        isBroad: false,
        points: [[400, 400], [880, 400], [880, 830], [820, 1030], [550, 1000], [400, 700]]
      },
      {
        id: 'cell_dean',
        name: '딘 가 펌프 권역',
        isBroad: false,
        points: [[400, 1000], [550, 1000], [820, 1030], [890, 1300], [800, 1550], [400, 1550]]
      },
      {
        id: 'cell_warwick',
        name: '워윅 가 권역',
        isBroad: false,
        points: [[1350, 400], [1800, 400], [1800, 1200], [1320, 1020], [1210, 790]]
      },
      {
        id: 'cell_bridle',
        name: '브라이들 골목 권역',
        isBroad: false,
        points: [[1320, 1020], [1800, 1200], [1800, 1550], [1340, 1550], [1320, 1280]]
      },
      {
        id: 'cell_rupert',
        name: '루퍼트 가 권역',
        isBroad: false,
        points: [[1340, 1550], [1800, 1550], [1800, 1950], [1180, 1950], [1180, 1750], [1340, 1650]]
      },
      {
        id: 'cell_tichborne',
        name: '티치본 가 권역',
        isBroad: false,
        points: [[400, 1550], [800, 1550], [890, 1300], [1180, 1370], [1180, 1950], [400, 1950]]
      }
    ];

    ctx.save();

    for (const cell of VORONOI_CELLS) {
      if (cell.points.length < 3) continue;

      ctx.beginPath();
      const [firstSx, firstSy] = this.worldToScreen(cell.points[0][0], cell.points[0][1]);
      ctx.moveTo(firstSx, firstSy);

      let centerWx = 0;
      let centerWy = 0;
      for (const [wx, wy] of cell.points) {
        const [sx, sy] = this.worldToScreen(wx, wy);
        ctx.lineTo(sx, sy);
        centerWx += wx;
        centerWy += wy;
      }
      ctx.closePath();

      centerWx /= cell.points.length;
      centerWy /= cell.points.length;
      const [labelSx, labelSy] = this.worldToScreen(centerWx, centerWy);

      if (cell.isBroad) {
        // 브로드 스트리트 권역 (핵심 감염지): 은은한 경고 붉은 틴트 및 빛나는 황금 테두리
        ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
        ctx.fill();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3.5 * this.zoom;
        ctx.setLineDash([12 * this.zoom, 8 * this.zoom]);
        ctx.stroke();

        // 텍스트 라벨
        ctx.setLineDash([]);
        ctx.font = `900 ${Math.max(14, 17 * this.zoom)}px -apple-system, sans-serif`;
        ctx.fillStyle = '#7f1d1d';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.fillText(`🚨 ${cell.name}`, labelSx, labelSy - 80 * this.zoom);
        ctx.shadowBlur = 0;
      } else {
        // 일반 펌프 권역: 부드러운 고지도 세피아 틴트 & 점선 경계
        ctx.fillStyle = 'rgba(120, 113, 108, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
        ctx.lineWidth = 2 * this.zoom;
        ctx.setLineDash([8 * this.zoom, 8 * this.zoom]);
        ctx.stroke();

        // 텍스트 라벨
        ctx.setLineDash([]);
        ctx.font = `bold ${Math.max(11, 13 * this.zoom)}px serif`;
        ctx.fillStyle = '#581c87';
        ctx.textAlign = 'center';
        ctx.fillText(`📍 ${cell.name}`, labelSx, labelSy);
      }
    }

    ctx.restore();
  }

  // ★ 1854 빅토리안 실사 건물 드로잉 (실제 19세기 런던 건축물 이미지 스프라이트 & 사망자 잉크 막대탑)
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

    ctx.save();
    ctx.translate(hx, hy);

    // 1. 실사 건물 스프라이트 렌더링
    let sprite = this.houseTerraceImg;
    let spriteW = 68 * scale;
    let spriteH = 88 * scale;
    let roofTopOffset = -42 * scale;

    if (isBrewery) {
      sprite = this.houseBreweryImg;
      spriteW = 105 * scale;
      spriteH = 92 * scale;
      roofTopOffset = -44 * scale;

      // 양조장 굴뚝 연기 파티클
      if (Math.random() < 0.12) {
        this.smokeParticles.push({
          x: hx - 32 * scale,
          y: hy - 44 * scale,
          life: 0,
          maxLife: 45 + Math.random() * 25,
          size: (4 + Math.random() * 4) * scale
        });
      }
    } else if (isWorkhouse) {
      sprite = this.houseWorkhouseImg;
      spriteW = 110 * scale;
      spriteH = 96 * scale;
      roofTopOffset = -46 * scale;
    }

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
    } else {
      // 이미지 로딩 중 대체 사각형
      ctx.fillStyle = isBrewery ? '#7f1d1d' : isWorkhouse ? '#475569' : '#a36a4f';
      ctx.fillRect(-spriteW / 2, -spriteH / 2, spriteW, spriteH);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(-spriteW / 2, -spriteH / 2, spriteW, spriteH);
    }

    // 2. ★ [존 스노우 1854 원본 고증] 조사 완료 시 지붕 위에 솟아오르는 검은 사망자 막대탑(Death Bars)!
    if (isInvestigated) {
      if (house.deaths > 0) {
        // 사망자 수만큼 차곡차곡 쌓이는 검은색 잉크 막대 (스노우 원본 지도 방식)
        const barW = 16 * scale;
        const barH = 3.6 * scale;
        const barGap = 1.2 * scale;
        const startY = roofTopOffset - 4 * scale;

        for (let i = 0; i < house.deaths; i++) {
          const by = startY - i * (barH + barGap);
          // 검은 잉크 바
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-barW / 2, by, barW, barH);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 0.8 * scale;
          ctx.strokeRect(-barW / 2, by, barW, barH);
        }

        // 탑 꼭대기 사망자 숫자 뱃지
        const topY = startY - house.deaths * (barH + barGap) - 5 * scale;
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.arc(0, topY, 6.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * scale;
        ctx.stroke();

        ctx.font = `900 ${Math.max(9, 10 * scale)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(house.deaths), 0, topY);
      } else {
        // 사망자 0명 안전 가구 (양조장 등) - 초록색 안전 방패 표식
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(0, roofTopOffset - 8 * scale, 8 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        ctx.font = `bold ${Math.max(8, 9 * scale)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0', 0, roofTopOffset - 8 * scale);
      }
    }

    // 3. 근접 시 부드러운 상호작용 하이라이트 & [조사 E] 플로팅 안내
    if (distToPlayer < 75) {
      // 바닥 주황빛 부드러운 펄스 링
      const ringR = (spriteW / 2 + 10 * scale) + Math.sin(this.animTick * 3) * 3 * scale;
      ctx.beginPath();
      ctx.arc(0, spriteH * 0.25, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5 * scale;
      ctx.setLineDash([6 * scale, 4 * scale]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 머리 위 세련된 조사 뱃지
      if (!isInvestigated) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(-34 * scale, roofTopOffset - 26 * scale, 68 * scale, 22 * scale, 10 * scale);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        ctx.font = `900 ${Math.max(12, 14 * scale)}px 'GangwonEduAllBold', sans-serif`;
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('현장 조사 [E]', 0, roofTopOffset - 15 * scale);
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

  // 빅토리안 무쇠 펌프 드로잉 (★ 모든 8개 펌프 실사 주물 스프라이트 렌더링!)
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

    const isRemoved = broadHandleRemoved && pump.isSource;
    const sprite = isRemoved ? this.pumpNoHandleImg : this.pumpImg;

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      // 실사 주물 펌프 스프라이트 렌더링 (w: 36, h: 60)
      const pw = 36 * scale;
      const ph = 60 * scale;
      ctx.drawImage(sprite, -pw / 2, -ph + 8 * scale, pw, ph);
    } else {
      // 대체 렌더링: 원형 화강암 석재 기단
      ctx.beginPath();
      ctx.arc(0, 0, 14 * scale, 0, Math.PI * 2);
      ctx.fillStyle = isRemoved ? '#475569' : '#64748b';
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3 * scale;
      ctx.stroke();

      // 무쇠 펌프 기둥
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

      // 주둥이
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-8 * scale, -4 * scale, 5 * scale, 4 * scale);
    }

    // 펌프 이름 명판 (세련된 빅토리안 황동/다크우드 플레이트)
    ctx.font = `bold ${Math.max(12, 13 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const label = pump.name + (pump.isSource && broadHandleRemoved ? " [손잡이 분리됨]" : "");
    const labelWidth = ctx.measureText(label).width;
    const plateH = 22;
    const plateY = 12 * scale;
    
    ctx.fillStyle = 'rgba(28, 18, 12, 0.9)';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-labelWidth / 2 - 8, plateY, labelWidth + 16, plateH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, plateY + plateH / 2);

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

  // 고지도 원본 도로망 노출 (약도형 밴드를 완전히 제거하여 1854 고지도의 골목과 도로가 선명하게 드러남)
  private renderCobblestoneStreets(_ctx: CanvasRenderingContext2D) {
    // 1854 고지도 snow_map.jpg 자체가 정밀한 석판 잉크 도로망을 지니고 있으므로
    // 인위적인 노란색 밴드 덮어씌우기를 생략하여 원본 고지도 길 위를 걷는 현실감을 100% 보존합니다.
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

  // ★ [고품질 실사 2D 게임 스프라이트] 빅토리안 의사 & 간호사 조사관 아바타
  private drawScientistAvatar(
    wx: number,
    wy: number,
    name: string,
    coatColor: string,
    team: string,
    isMe: boolean,
    walkTick: number,
    hatStyle: string = 'silk_hat',
    toolStyle: string = 'magnifier',
    gender: PlayerGender = 'male'
  ) {
    const [sx, sy] = this.worldToScreen(wx, wy);
    const ctx = this.ctx;
    const scale = this.zoom;
    const isFemale = gender === 'female';
    const spriteImg = isFemale ? this.charFemaleImg : this.charMaleImg;

    // 보행 애니메이션 (상하 바운스 + 살짝 기우는 워킹 틸트)
    const isWalking = walkTick > 0;
    const bounceY = isWalking ? Math.abs(Math.sin(walkTick * 4)) * -4 * scale : 0;
    const walkTilt = isWalking ? Math.sin(walkTick * 4) * 0.05 : 0;

    ctx.save();
    ctx.translate(sx, sy + bounceY);
    ctx.rotate(walkTilt);

    // 1. 발 밑 부드러운 타원 그림자
    ctx.beginPath();
    ctx.ellipse(0, 18 * scale, 16 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fill();

    // 2. 본체 2D 실사/일러스트 스프라이트 렌더링
    const targetHeight = 56 * scale;
    if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
      const aspect = spriteImg.naturalWidth / spriteImg.naturalHeight;
      const targetWidth = targetHeight * aspect;
      
      // 내 캐릭터일 경우 은은한 림라이트/하이라이트 발광
      if (isMe) {
        ctx.shadowColor = coatColor || '#38bdf8';
        ctx.shadowBlur = 12 * scale;
      }

      ctx.drawImage(
        spriteImg,
        -targetWidth / 2,
        -targetHeight + 18 * scale,
        targetWidth,
        targetHeight
      );
      ctx.shadowBlur = 0;
    } else {
      // 스프라이트 로딩 전 대체 그래픽
      ctx.fillStyle = coatColor || '#0f172a';
      ctx.fillRect(-10 * scale, -targetHeight + 18 * scale, 20 * scale, targetHeight);
    }

    // 3. 내 캐릭터 표시 오라/링
    if (isMe) {
      ctx.beginPath();
      ctx.arc(0, 18 * scale, 18 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = coatColor || '#f59e0b';
      ctx.lineWidth = 2.5 * scale;
      ctx.setLineDash([4 * scale, 3 * scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. 머리 위 정자체 닉네임 명패 (Nothing Design 안티슬롭 정자체)
    const labelY = -targetHeight + 2 * scale;
    ctx.font = `900 ${Math.max(12, 13 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const textWidth = ctx.measureText(name).width;
    const boxH = 22;
    
    // 명패 배경 박스
    ctx.fillStyle = isMe ? 'rgba(15, 23, 42, 0.92)' : 'rgba(30, 41, 59, 0.88)';
    ctx.strokeStyle = isMe ? (coatColor || '#fbbf24') : '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-textWidth / 2 - 8, labelY - boxH, textWidth + 16, boxH, 6);
    ctx.fill();
    ctx.stroke();

    // 닉네임 텍스트
    ctx.fillStyle = isMe ? '#fef08a' : '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 0, labelY - boxH / 2);

    ctx.restore();
  }
}
