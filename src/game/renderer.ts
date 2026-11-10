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

  // 걷기 애니메이션 타이머
  private animTick = 0;

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
    this.animTick += isMoving ? 0.2 : 0.05;

    // 카메라 부드러운 추적 (Lerp)
    this.cameraX += (myPlayer.x - this.cameraX) * 0.12;
    this.cameraY += (myPlayer.y - this.cameraY) * 0.12;
    this.zoom += (this.targetZoom - this.zoom) * 0.1;

    // 1. 1854 빅토리안 빈티지 양피지 고지도 질감 (#f1e7d0)
    ctx.fillStyle = '#f1e7d0';
    ctx.fillRect(0, 0, width, height);

    // 고지도 모눈눈금선 및 에이징 그리드
    ctx.strokeStyle = 'rgba(140, 115, 80, 0.15)';
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

    // 2. 브로드 펌프 중심 역학 감염 위험지대 (동심원 히트맵)
    // 조사가 진행될수록 브로드 펌프 주변에 핏빛 붉은 역학 위험 구역이 점진적으로 선명해짐
    const investigatedCount = Object.keys(investigations).length;
    if (investigatedCount > 0) {
      const broadPump = this.data.pumps.find(p => p.isSource);
      if (broadPump) {
        const [bx, by] = this.worldToScreen(broadPump.x, broadPump.y);
        const radius = Math.min(220, (60 + investigatedCount * 7)) * this.zoom;
        const heatGrad = ctx.createRadialGradient(bx, by, 10 * this.zoom, bx, by, radius);
        heatGrad.addColorStop(0, 'rgba(185, 28, 28, 0.28)');
        heatGrad.addColorStop(0.5, 'rgba(220, 38, 38, 0.12)');
        heatGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = heatGrad;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();

        // 파동 펄스 링
        ctx.strokeStyle = 'rgba(185, 28, 28, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(bx, by, radius * (0.8 + Math.sin(this.animTick * 0.5) * 0.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 3. 특수 구역 및 건물 블록 (양조장, 구빈원, 골든 스퀘어)
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
        ctx.fillStyle = 'rgba(217, 119, 6, 0.25)'; // 호박색 양조장
      } else if (block.id === 'workhouse_block') {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.25)'; // 회색 구빈원
      } else {
        ctx.fillStyle = 'rgba(132, 175, 115, 0.25)'; // 녹색 잔디 광장
      }
      ctx.fill();
      ctx.strokeStyle = '#786548';
      ctx.lineWidth = 2 * this.zoom;
      ctx.stroke();

      // 건물 내부 잉크 해칭선 (19세기 고지도 특유의 필지 표현)
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(120, 100, 70, 0.2)';
      ctx.lineWidth = 1;
      const bMinX = Math.min(...block.polygon.map(p => this.worldToScreen(p[0], p[1])[0]));
      const bMaxX = Math.max(...block.polygon.map(p => this.worldToScreen(p[0], p[1])[0]));
      const bMinY = Math.min(...block.polygon.map(p => this.worldToScreen(p[0], p[1])[1]));
      const bMaxY = Math.max(...block.polygon.map(p => this.worldToScreen(p[0], p[1])[1]));
      for (let lx = bMinX - (bMaxY - bMinY); lx < bMaxX; lx += 12 * this.zoom) {
        ctx.beginPath();
        ctx.moveTo(lx, bMinY);
        ctx.lineTo(lx + (bMaxY - bMinY), bMaxY);
        ctx.stroke();
      }
      ctx.restore();

      // 구역 라벨
      if (block.label) {
        const center = this.worldToScreen(
          (block.polygon[0][0] + block.polygon[2][0]) / 2,
          (block.polygon[0][1] + block.polygon[2][1]) / 2
        );
        ctx.font = `italic bold ${Math.max(10, 12 * this.zoom)}px 'Georgia', serif`;
        ctx.fillStyle = '#453723';
        ctx.textAlign = 'center';
        ctx.fillText(block.label, center[0], center[1]);
      }
    }

    // 4. 소호 거리 도로망 렌더링 (조약돌 도로 질감)
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
      // 도로 바닥
      ctx.strokeStyle = '#e6d8ba';
      ctx.lineWidth = (street.isMain ? 28 : 18) * this.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 도로 잉크 테두리
      ctx.strokeStyle = '#b8a582';
      ctx.lineWidth = (street.isMain ? 30 : 20) * this.zoom;
      ctx.stroke();

      // 도로명 텍스트
      const midIdx = Math.floor(street.points.length / 2);
      const [mx, my] = this.worldToScreen(street.points[midIdx][0], street.points[midIdx][1]);
      ctx.font = `bold ${Math.max(9, 11 * this.zoom)}px 'Times New Roman', serif`;
      ctx.fillStyle = '#5c4d38';
      ctx.textAlign = 'center';
      ctx.fillText(street.name.toUpperCase(), mx, my - 6 * this.zoom);
    }

    // 5. 가구 (Houses) 렌더링
    for (const house of this.data.houses) {
      const [hx, hy] = this.worldToScreen(house.x, house.y);
      const isInvestigated = !!investigations[house.id];
      const distToPlayer = Math.hypot(house.x - myPlayer.x, house.y - myPlayer.y);

      ctx.save();
      ctx.translate(hx, hy);

      if (isInvestigated) {
        // [조사 완료] 역학 지도 붉은 점 표기
        if (house.deaths > 0) {
          // 사망자 수에 비례하는 붉은 원
          const dotR = Math.min(22, (5 + house.deaths * 2.2) * this.zoom);
          ctx.beginPath();
          ctx.arc(0, 0, dotR, 0, Math.PI * 2);
          ctx.fillStyle = '#b91c1c';
          ctx.fill();
          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 사망자 숫자 표기
          ctx.font = `bold ${Math.max(10, 12 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(house.deaths), 0, 0);
        } else {
          // 사망자 0명 (양조장 등 이상치): 승리의 녹색 쉴드
          ctx.beginPath();
          ctx.arc(0, 0, 11 * this.zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#16a34a';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.font = `bold ${Math.max(9, 11 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText("0", 0, 0);
        }
      } else {
        // [미조사 가구] 빅토리안 붉은 벽돌집 그래픽
        const size = 15 * this.zoom;
        ctx.fillStyle = '#8b5a36'; // 벽돌색
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeStyle = '#3d2514';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-size / 2, -size / 2, size, size);

        // 지붕 삼각 박공
        ctx.beginPath();
        ctx.moveTo(-size / 2, -size / 2);
        ctx.lineTo(0, -size);
        ctx.lineTo(size / 2, -size / 2);
        ctx.closePath();
        ctx.fillStyle = '#5c3a21';
        ctx.fill();
        ctx.stroke();

        // 굴뚝 연기 효과
        ctx.fillStyle = 'rgba(120, 120, 120, 0.4)';
        ctx.beginPath();
        ctx.arc(size * 0.3, -size * 1.2 - Math.sin(this.animTick) * 2, 3 * this.zoom, 0, Math.PI * 2);
        ctx.fill();

        // ★ [핵심] 가구 접근 시 큼직하고 화려한 상호작용 안내 뱃지
        if (distToPlayer < 45) {
          // 바닥 황금빛 펄스 링
          const pulse = (Math.sin(this.animTick * 2) + 1) / 2;
          ctx.beginPath();
          ctx.arc(0, 0, (size + pulse * 12) * this.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(234, 179, 8, ${0.9 - pulse * 0.5})`;
          ctx.lineWidth = 3;
          ctx.stroke();

          // 머리 위 3D 느낌의 [E] 조사 뱃지
          ctx.save();
          ctx.translate(0, -size * 1.6);
          // 뱃지 배경
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.roundRect(-24 * this.zoom, -12 * this.zoom, 48 * this.zoom, 24 * this.zoom, 6 * this.zoom);
          ctx.fill();
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 텍스트
          ctx.font = `900 ${Math.max(11, 13 * this.zoom)}px -apple-system, sans-serif`;
          ctx.fillStyle = '#451a03';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText("조사 [E]", 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // 6. 공공 식수 펌프 (Pumps) 렌더링
    for (const pump of this.data.pumps) {
      const [px, py] = this.worldToScreen(pump.x, pump.y);
      const isBroad = pump.isSource;

      ctx.save();
      ctx.translate(px, py);

      // 펌프 대리석 받침대
      ctx.beginPath();
      ctx.arc(0, 0, (isBroad ? 16 : 10) * this.zoom, 0, Math.PI * 2);
      ctx.fillStyle = isBroad ? (broadHandleRemoved ? '#64748b' : '#0284c7') : '#475569';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5 * this.zoom;
      ctx.stroke();

      // 무쇠 펌프 기둥
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-3 * this.zoom, -10 * this.zoom, 6 * this.zoom, 14 * this.zoom);

      // 주물 손잡이
      if (!isBroad || !broadHandleRemoved) {
        ctx.beginPath();
        ctx.moveTo(0, -8 * this.zoom);
        ctx.lineTo(10 * this.zoom, -2 * this.zoom);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2.5 * this.zoom;
        ctx.stroke();
      }

      // 펌프 라벨 (황금빛 현판)
      ctx.font = `bold ${Math.max(10, 11 * this.zoom)}px 'Georgia', serif`;
      ctx.fillStyle = isBroad ? '#0369a1' : '#334155';
      ctx.textAlign = 'center';
      const label = pump.name + (isBroad && broadHandleRemoved ? " [손잡이 제거됨!]" : "");
      ctx.fillText(label, 0, 20 * this.zoom);

      // 브로드 펌프 손잡이 제거 상호작용 배너
      if (isBroad && !broadHandleRemoved) {
        const dist = Math.hypot(pump.x - myPlayer.x, pump.y - myPlayer.y);
        if (dist < 45) {
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.roundRect(-55 * this.zoom, -38 * this.zoom, 110 * this.zoom, 22 * this.zoom, 6 * this.zoom);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.font = `bold ${Math.max(10, 11 * this.zoom)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText("손잡이 제거 [Space]", 0, -23 * this.zoom);
        }
      }
      ctx.restore();
    }

    // 7. 장기설(Miasma) 악취 마커 & 독성 스모그 안개
    if (this.showMiasmaFog) {
      for (const m of this.data.miasmaMarkers) {
        const [mx, my] = this.worldToScreen(m.x, m.y);
        const fogR = (80 + Math.sin(this.animTick + m.x) * 10) * this.zoom;
        const grad = ctx.createRadialGradient(mx, my, 5 * this.zoom, mx, my, fogR);
        grad.addColorStop(0, 'rgba(80, 120, 40, 0.45)');
        grad.addColorStop(1, 'rgba(80, 120, 40, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, fogR, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `italic bold ${Math.max(9, 10 * this.zoom)}px serif`;
        ctx.fillStyle = '#2d3f16';
        ctx.textAlign = 'center';
        ctx.fillText(`💨 ${m.name}`, mx, my + 16 * this.zoom);
      }
    }

    // 8. 다른 플레이어 아바타 렌더링
    for (const player of otherPlayers) {
      this.drawScientistAvatar(player.x, player.y, player.name, player.color, player.team, false, 0);
    }

    // 9. 내 아바타 렌더링 (최상단, 걷기 바운스 적용)
    this.drawScientistAvatar(myPlayer.x, myPlayer.y, `${myPlayer.name} (나)`, myPlayer.color, myPlayer.team, true, isMoving ? this.animTick : 0);
  }

  // ★ 19세기 빅토리안 의사/과학자 정밀 아바타 드로잉 함수
  private drawScientistAvatar(wx: number, wy: number, name: string, coatColor: string, team: string, isMe: boolean, walkTick: number) {
    const [sx, sy] = this.worldToScreen(wx, wy);
    const ctx = this.ctx;
    const scale = this.zoom;

    // 걷기 바운스 오프셋
    const bounceY = Math.sin(walkTick * 4) * 2 * scale;
    const legSwing = Math.sin(walkTick * 4) * 4 * scale;

    ctx.save();
    ctx.translate(sx, sy + bounceY);

    // 1. 하단 그림자
    ctx.beginPath();
    ctx.ellipse(0, 14 * scale, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();

    // 2. 다리 (걷는 모션)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3 * scale;
    // 왼다리
    ctx.beginPath();
    ctx.moveTo(-4 * scale, 6 * scale);
    ctx.lineTo(-4 * scale + legSwing, 14 * scale);
    ctx.stroke();
    // 오른다리
    ctx.beginPath();
    ctx.moveTo(4 * scale, 6 * scale);
    ctx.lineTo(4 * scale - legSwing, 14 * scale);
    ctx.stroke();

    // 3. 의사 롱코트 (Frock Coat - 팀 컬러)
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.moveTo(-8 * scale, -6 * scale);
    ctx.lineTo(8 * scale, -6 * scale);
    ctx.lineTo(11 * scale, 10 * scale);
    ctx.lineTo(-11 * scale, 10 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isMe ? '#ffffff' : '#0f172a';
    ctx.lineWidth = isMe ? 2 : 1.2;
    ctx.stroke();

    // 코트 옷깃 & 넥타이
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-3 * scale, -6 * scale);
    ctx.lineTo(0, 0);
    ctx.lineTo(3 * scale, -6 * scale);
    ctx.fill();

    // 4. 얼굴
    ctx.beginPath();
    ctx.arc(0, -9 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#fed7aa'; // 피부톤
    ctx.fill();
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 5. 빅토리안 신사 실크햇 (Top Hat)
    ctx.fillStyle = '#0f172a'; // 흑색 모자
    // 모자 챙
    ctx.fillRect(-10 * scale, -13 * scale, 20 * scale, 2.5 * scale);
    // 모자 본체
    ctx.fillRect(-6 * scale, -23 * scale, 12 * scale, 10 * scale);
    // 모자 리본 띠
    ctx.fillStyle = coatColor;
    ctx.fillRect(-6 * scale, -15 * scale, 12 * scale, 2 * scale);

    // 6. 오른손: 반짝이는 황금빛 돋보기 (Magnifying Glass)
    const glassX = 12 * scale;
    const glassY = -2 * scale;
    // 돋보기 손잡이
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(6 * scale, 2 * scale);
    ctx.lineTo(glassX, glassY);
    ctx.stroke();
    // 돋보기 림(Rim) & 렌즈
    ctx.beginPath();
    ctx.arc(glassX, glassY, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.6)'; // 푸른 유리 렌즈
    ctx.fill();
    ctx.strokeStyle = '#f59e0b'; // 황금빛 테두리
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();
    // 렌즈 반사광
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.arc(glassX - 1.5 * scale, glassY - 1.5 * scale, 2.5 * scale, 0, Math.PI * 0.8);
    ctx.stroke();

    // 7. 왼손: 갈색 가죽 의사 왕진 가방 (Doctor's Bag)
    const bagX = -11 * scale;
    const bagY = 2 * scale;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(bagX - 4 * scale, bagY, 8 * scale, 6 * scale);
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(bagX - 4 * scale, bagY, 8 * scale, 6 * scale);

    // 8. 머리 위 이름표 & 팀 명찰
    ctx.font = `bold ${Math.max(10, 11 * scale)}px -apple-system, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(name, 0, -26 * scale);

    ctx.restore();
  }
}
