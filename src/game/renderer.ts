import { Avatar, RemotePlayer, Site, SiteKind } from '../types.ts';
import { SITES, PUMPS, MIASMA, WORLD_W, WORLD_H, WORLD_SCALE, LOOK_FACING, teamColor } from '../data/story.ts';
import snowDeaths from '../data/snow_deaths.gen.json';

const INK = '#231a12';
const PAPER = '#f6efdc';
const RED = '#D71921';
const FONT = "'GangwonEdu Modu', 'Malgun Gothic', sans-serif";

export interface Frame {
  me: Avatar;
  others: RemotePlayer[];
  records: Set<string>;
  /** 학급 친구들이 조사한 곳 (상황판에서 함께 보여 준다) */
  classRecords: Set<string>;
  targets: Set<string>;
  nearId: string | null;
  /** 지도를 눌러 걷는 중인 경로 */
  path: [number, number][] | null;
  /** 지금 할 일까지 길을 따라가는 안내선과 그 목적지 이름 */
  guide: [number, number][] | null;
  guideName: string;
  handleRemoved: boolean;
  /** 내 영역이 맡은 집과 그 영역의 색 */
  district: Set<string>;
  districtColor: string;
  showFog: boolean;
  showCatchment: boolean;
  /** 스노우가 기록한 사망자 578명 전부 (공개 디지털화 자료) */
  showReal: boolean;
  board: boolean;
  time: number;
}

/** 건물 그림의 폭(월드 단위). 높이는 그림 비율을 따른다 */
const ICON_W: Record<SiteKind, number> = { house: 28, brewery: 62, factory: 50, workhouse: 92 };
const AVATAR_H = 44;
/** 이보다 작게 보면(축소하면) 막대 대신 원으로 사망자 수를 보인다 */
const DOT_ZOOM = 1.15;
const PUMP_H = 44;

interface Label { str: string; x: number; y: number; size: number; color: string; top: boolean; prio: number }

function load(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}
const ok = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

export class Renderer {
  public camX = WORLD_W / 2;
  public camY = WORLD_H / 2;
  public zoom = 2;
  public zoomTarget = 2;
  /** 값이 있으면 플레이어 대신 이 지점을 비춘다 (전체 지도, 연출) */
  public focus: { x: number; y: number } | null = null;

  private ctx: CanvasRenderingContext2D;
  private vw = 0;
  private vh = 0;
  private labels: Label[] = [];
  private map = load('./assets/soho_map.webp');
  private catchment = load('./assets/catchment.png');
  private pump = load('./assets/pump.webp');
  private pumpNoHandle = load('./assets/pump_no_handle.webp');
  /** 조사관 전신 그림. 처음 쓸 때 불러온다 */
  private chars = new Map<string, HTMLImageElement>();
  private char(look: string) {
    let img = this.chars.get(look);
    if (!img) { img = load(`./assets/characters/inv_${look}.webp`); this.chars.set(look, img); }
    return img;
  }
  private icons: Record<SiteKind, HTMLImageElement> = {
    house: load('./assets/houses/house_terrace.webp'),
    brewery: load('./assets/houses/house_brewery.webp'),
    factory: load('./assets/houses/house_factory.webp'),
    workhouse: load('./assets/houses/house_workhouse.webp'),
  };

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public get baseZoom() { return Math.max(1.5, Math.min(2.6, Math.min(this.vw, this.vh) / 400)); }
  /** 브로드 가 일대가 한 화면에 들어오는 배율 */
  public get overviewZoom() { return Math.min(this.vw / 1500, this.vh / 1150); }

  public resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * dpr);
    this.canvas.height = Math.round(this.vh * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public jumpTo(x: number, y: number) {
    this.camX = x; this.camY = y;
    this.zoom = this.zoomTarget = this.baseZoom;
  }

  public toScreen(wx: number, wy: number): [number, number] {
    return [this.vw / 2 + (wx - this.camX) * this.zoom, this.vh / 2 + (wy - this.camY) * this.zoom];
  }

  public toWorld(sx: number, sy: number): [number, number] {
    return [this.camX + (sx - this.vw / 2) / this.zoom, this.camY + (sy - this.vh / 2) / this.zoom];
  }

  private iconSize(kind: SiteKind): [number, number] {
    const img = this.icons[kind], w = ICON_W[kind];
    return [w, ok(img) ? w * img.naturalHeight / img.naturalWidth : w * 1.2];
  }

  /** 화면 좌표가 가리키는 조사 장소(건물 그림이나 문) */
  public siteAt(sx: number, sy: number): Site | null {
    const [wx, wy] = this.toWorld(sx, sy);
    for (const s of SITES) {
      if (Math.hypot(wx - s.door[0], wy - s.door[1]) < 16) return s;
    }
    for (const s of SITES) {
      if (s.points) continue;
      const [iw, ih] = this.iconSize(s.kind);
      if (Math.abs(wx - s.icon[0]) < iw / 2 + 4 && wy < s.icon[1] + 4 && wy > s.icon[1] - ih - 4) return s;
    }
    return null;
  }

  public draw(f: Frame) {
    const ctx = this.ctx;
    const target = this.focus ?? f.me;
    this.camX += (target.x - this.camX) * 0.12;
    this.camY += (target.y - this.camY) * 0.12;
    this.zoom += (this.zoomTarget - this.zoom) * 0.1;
    const z = this.zoom;
    this.labels = [];

    ctx.fillStyle = '#c9b68a';
    ctx.fillRect(0, 0, this.vw, this.vh);
    this.drawMap();

    if (f.showCatchment && ok(this.catchment)) {
      const [x, y] = this.toScreen(0, 0);
      ctx.globalAlpha = 0.5 + Math.sin(f.time * 2) * 0.08;
      ctx.drawImage(this.catchment, x, y, WORLD_W * z, WORLD_H * z);
      ctx.globalAlpha = 1;
    }
    if (f.showFog) this.drawFog(f.time);
    if (f.guide && !f.board) this.drawGuide(f);
    if (f.path) this.drawPath(f);

    for (const s of SITES) this.drawDoor(s, f);

    // 아래쪽에 있는 것이 위를 덮도록 y 순서로 그린다
    const sprites: { y: number; draw: () => void }[] = [];
    for (const s of SITES) sprites.push({ y: s.icon[1], draw: () => this.drawSite(s, f) });
    for (const p of PUMPS) sprites.push({ y: p.y, draw: () => this.drawPump(p.x, p.y, p.isBroad && f.handleRemoved) });
    for (const [i, o] of f.others.entries()) {
      // 같은 자리에 겹쳐 선 친구는 옆으로 반 걸음 비켜 그린다
      const close = Math.hypot(o.x - f.me.x, o.y - f.me.y) < 14;
      const shift = close ? (i % 2 ? -1 : 1) * (14 + Math.floor(i / 2) * 10) : 0;
      sprites.push({ y: o.y - 0.01, draw: () => this.drawAvatar(o, false, f.time, shift) });
    }
    sprites.push({ y: f.me.y, draw: () => this.drawAvatar(f.me, true, f.time, 0) });
    sprites.sort((a, b) => a.y - b.y);
    for (const s of sprites) s.draw();
    if (f.showReal) this.drawRealDeaths();

    this.queueLabels(f);
    this.flushLabels();
  }

  private drawMap() {
    if (!ok(this.map)) return;
    const ctx = this.ctx, z = this.zoom;
    const k = this.map.naturalWidth / WORLD_W;               // 지도 그림 픽셀 / 월드 단위
    const [wx0, wy0] = this.toWorld(0, 0);
    const [wx1, wy1] = this.toWorld(this.vw, this.vh);
    const x0 = Math.max(0, wx0), y0 = Math.max(0, wy0), x1 = Math.min(WORLD_W, wx1), y1 = Math.min(WORLD_H, wy1);
    if (x1 <= x0 || y1 <= y0) return;
    const [sx, sy] = this.toScreen(x0, y0);
    ctx.drawImage(this.map, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, sx, sy, (x1 - x0) * z, (y1 - y0) * z);
  }

  /** 당국이 믿는 독기를 누런 안개로 보여 준다 */
  private drawFog(time: number) {
    const ctx = this.ctx, z = this.zoom;
    for (const [i, m] of MIASMA.entries()) {
      for (let k = 0; k < 3; k++) {
        const a = time * 0.25 + i * 2 + k * 2.1;
        const [x, y] = this.toScreen(m.x + Math.cos(a) * 26, m.y + Math.sin(a * 1.3) * 18);
        const r = (70 + k * 22) * z;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(108, 118, 40, 0.30)');
        grad.addColorStop(1, 'rgba(108, 118, 40, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  }

  /** 지금 할 일까지, 길을 따라 붉은 점선으로 안내한다. 목적지가 화면 밖이면 선이 화면을 벗어나는 곳에 화살표를 단다 */
  private drawGuide(f: Frame) {
    const ctx = this.ctx;
    const pts = [[f.me.x, f.me.y] as [number, number], ...f.guide!].map(p => this.toScreen(p[0], p[1]));
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.strokeStyle = 'rgba(246, 239, 220, 0.9)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 4;
    ctx.setLineDash([3, 13]);
    ctx.lineDashOffset = -f.time * 30;                 // 점이 목적지 쪽으로 흐른다
    ctx.stroke();
    ctx.restore();

    // 화면(정보 패널을 뺀 안쪽)을 벗어나는 첫 지점을 찾는다
    const padX = 60, top = 150, bottom = 150;
    const inside = (p: number[]) => p[0] > padX && p[0] < this.vw - padX && p[1] > top && p[1] < this.vh - bottom;
    for (let i = 1; i < pts.length; i++) {
      if (inside(pts[i])) continue;
      const a = pts[i - 1], b = pts[i];
      if (!inside(a) && i > 1) break;
      let lo = 0, hi = 1;
      for (let k = 0; k < 12; k++) {
        const t = (lo + hi) / 2;
        if (inside([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) lo = t; else hi = t;
      }
      const x = a[0] + (b[0] - a[0]) * lo, y = a[1] + (b[1] - a[1]) * lo;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = RED;
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(20, 0); ctx.lineTo(-10, -14); ctx.lineTo(-4, 0); ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      this.label(f.guideName, x - Math.cos(ang) * 30, y - Math.sin(ang) * 30 - 16, 19, RED, 6);
      break;
    }
  }

  private drawPath(f: Frame) {
    const ctx = this.ctx, path = f.path!;
    ctx.save();
    const [ex, ey] = this.toScreen(...path[path.length - 1]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(ex, ey, 8 + Math.sin(f.time * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** 문 앞 표시: 조사할 곳은 붉은 고리, 기록한 곳은 검은 점 */
  private drawDoor(s: Site, f: Frame) {
    const ctx = this.ctx;
    const [x, y] = this.toScreen(s.door[0], s.door[1]);
    if (x < -40 || y < -40 || x > this.vw + 40 || y > this.vh + 40) return;
    const done = f.records.has(s.id);
    const target = f.targets.has(s.id);
    const free = !!s.points && !target && f.nearId !== s.id;
    if (free && this.zoom < 1.1 && !done) return;            // 전체 지도에서는 자유 조사 집의 빈 문을 감춘다
    const r = free ? Math.max(3.5, 3.6 * this.zoom) : Math.max(5, 5.5 * this.zoom);
    if (target) {
      const pulse = (f.time * 0.9) % 1;
      ctx.strokeStyle = RED;
      ctx.globalAlpha = 1 - pulse;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + pulse * 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 내 구역에서 아직 조사하지 않은 집: 영역 색 점선 고리
    if (!done && !target && f.district.has(s.id)) {
      ctx.save();
      ctx.strokeStyle = f.districtColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = done ? INK : PAPER;
    ctx.fill();
    ctx.lineWidth = target ? 3 : 2;
    ctx.strokeStyle = target ? RED : INK;
    ctx.stroke();
    if (done) {
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = Math.max(1.5, r * 0.3);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.45, y);
      ctx.lineTo(x - r * 0.1, y + r * 0.38);
      ctx.lineTo(x + r * 0.5, y - r * 0.35);
      ctx.stroke();
    }
  }

  private drawSite(s: Site, f: Frame) {
    if (s.points) { this.drawFreeSite(s, f); return; }
    const ctx = this.ctx, z = this.zoom;
    const [iw, ih] = this.iconSize(s.kind);
    const [x, y] = this.toScreen(s.icon[0], s.icon[1]);
    if (x < -200 || y < -80 || x > this.vw + 200 || y > this.vh + 320) return;
    const w = iw * z, h = ih * z;

    ctx.fillStyle = 'rgba(35, 26, 18, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.56, Math.max(3, h * 0.05), 0, 0, Math.PI * 2);
    ctx.fill();

    const near = f.nearId === s.id;
    const img = this.icons[s.kind];
    if (ok(img) && z < DOT_ZOOM && (f.records.has(s.id) || f.classRecords.has(s.id))) ctx.globalAlpha = 0.45;
    if (ok(img)) {
      if (near) { ctx.shadowColor = 'rgba(255, 244, 214, 0.95)'; ctx.shadowBlur = 16; }
      ctx.drawImage(img, x - w / 2, y - h, w, h);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // 내 기록과, 같은 영역 친구들이 조사한 곳의 기록 (친구 것은 조금 옅게)
    const mine = f.records.has(s.id);
    if (!mine && !f.classRecords.has(s.id)) return;
    ctx.save();
    ctx.globalAlpha = mine ? 1 : 0.6;
    if (z < DOT_ZOOM) this.drawDeathDot(s, x, y);
    else this.drawDeathBars(s, x - w / 2, y);
    ctx.restore();
  }

  /** 자유 조사 집: 기록하면 스노우의 지도와 같은 자리에 막대를 쌓는다 */
  private drawFreeSite(s: Site, f: Frame) {
    const mine = f.records.has(s.id);
    if (!mine && !f.classRecords.has(s.id)) return;
    const ctx = this.ctx, z = this.zoom;
    const pts = s.points!;
    const [dx, dy] = pts.length > 1
      ? (() => { const a = pts[0], b = pts[pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; })()
      : (() => { const l = Math.hypot(pts[0][0] - s.door[0], pts[0][1] - s.door[1]) || 1; return [(pts[0][0] - s.door[0]) / l, (pts[0][1] - s.door[1]) / l]; })();
    const half = Math.max(4.5 * z, 5.5), thick = Math.max(1.8 * z, 2.6);
    const px = -dy * half, py = dx * half;
    ctx.save();
    ctx.globalAlpha = mine ? 1 : 0.6;
    ctx.beginPath();
    for (const [wx, wy] of pts) {
      const [x, y] = this.toScreen(wx, wy);
      ctx.moveTo(x - px, y - py);
      ctx.lineTo(x + px, y + py);
    }
    ctx.strokeStyle = 'rgba(246, 239, 220, 0.95)';
    ctx.lineWidth = thick + 2.5;
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = thick;
    ctx.stroke();
    ctx.restore();
  }

  /** 스노우의 지도처럼: 집 앞 길에서 블록 안쪽으로, 사망자 한 명에 막대 하나씩 쌓는다 */
  private drawRealDeaths() {
    const ctx = this.ctx, z = this.zoom;
    const half = Math.max(4.5 * z, 5.5), thick = Math.max(1.8 * z, 2.6);
    ctx.save();
    ctx.lineCap = 'butt';
    for (const h of snowDeaths.houses) {
      const [dx, dy] = h.dir;
      const px = -dy * half, py = dx * half;          // 쌓는 방향에 수직
      ctx.beginPath();
      for (const [mx, my] of h.points) {
        const [x, y] = this.toScreen(mx * WORLD_SCALE, my * WORLD_SCALE);
        if (x < -20 || y < -20 || x > this.vw + 20 || y > this.vh + 20) continue;
        ctx.moveTo(x - px, y - py);
        ctx.lineTo(x + px, y + py);
      }
      // 종이색 테두리를 둘러 지도 선과 건물 그림 위에서도 막대가 읽히게 한다
      ctx.strokeStyle = 'rgba(246, 239, 220, 0.95)';
      ctx.lineWidth = thick + 2.5;
      ctx.stroke();
      ctx.strokeStyle = h.broad ? '#5a0d10' : '#140e09';
      ctx.lineWidth = thick;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 가까이서는 스노우의 지도처럼 사망자 한 명에 검은 막대 하나 */
  private drawDeathBars(s: Site, iconLeft: number, y: number) {
    const ctx = this.ctx, z = this.zoom;
    const bars = s.mapDeaths ?? s.deaths;
    const bw = Math.max(12 * z, 18), bh = Math.max(2.8 * z, 4), pitch = Math.max(4.2 * z, 6.5), perCol = 9;
    const left = iconLeft - Math.max(5 * z, 6) - bw;
    const cols = Math.max(1, Math.ceil(bars / perCol));
    const topY = y - Math.min(Math.max(bars, 1), perCol) * pitch;
    // 종이색 바탕을 깔아 지도의 검은 선과 섞이지 않게 한다
    ctx.fillStyle = 'rgba(246, 239, 220, 0.92)';
    ctx.beginPath();
    ctx.roundRect(left - (cols - 1) * (bw + 3) - 4, topY - 4, cols * (bw + 3) + 5, y - topY + 6, 4);
    ctx.fill();
    ctx.fillStyle = INK;
    for (let i = 0; i < bars; i++) {
      const col = Math.floor(i / perCol), row = i % perCol;
      ctx.fillRect(left - col * (bw + 3), y - bh - row * pitch, bw, bh);
    }
    this.label(`${bars}명`, left + bw / 2 - (cols - 1) * (bw + 3) / 2, topY - 8, 19, bars ? INK : '#5f5446', 4);
  }

  /** 멀리서는 사망자 수만큼 넓어지는 검은 원 (넓이가 사람 수에 비례) */
  private drawDeathDot(s: Site, x: number, y: number) {
    const ctx = this.ctx;
    const bars = s.mapDeaths ?? s.deaths;
    const r = bars ? 7 + Math.sqrt(bars) * 3.4 : 8;
    const cy = y - r - 2;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = PAPER;
    ctx.stroke();
    if (bars) {
      ctx.fillStyle = INK;
      ctx.fill();
    } else {
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    ctx.font = `700 ${r >= 12 ? 15 : 13}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = bars ? PAPER : INK;
    ctx.fillText(String(bars), x, cy + 1);
  }

  private drawPump(wx: number, wy: number, noHandle: boolean) {
    const ctx = this.ctx, z = this.zoom;
    const [x, y] = this.toScreen(wx, wy);
    if (x < -60 || y < -20 || x > this.vw + 60 || y > this.vh + 140) return;
    const img = noHandle ? this.pumpNoHandle : this.pump;
    if (!ok(img)) return;
    const h = PUMP_H * z, w = h * img.naturalWidth / img.naturalHeight;
    ctx.fillStyle = 'rgba(35, 26, 18, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.3, 3 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, x - w / 2, y - h + 2 * z, w, h);
  }

  private drawAvatar(a: Avatar, isMe: boolean, time: number, shift: number) {
    const ctx = this.ctx, z = this.zoom;
    const [x, y] = this.toScreen(a.x + shift, a.y);
    if (x < -80 || y < -40 || x > this.vw + 80 || y > this.vh + 160) return;
    const img = this.char(a.look || 'f1');
    const h = AVATAR_H * z, w = ok(img) ? h * img.naturalWidth / img.naturalHeight : h * 0.35;
    const step = a.moving ? time * 9 : 0;
    const bob = a.moving ? Math.abs(Math.sin(step)) * 2.2 * z : 0;

    ctx.fillStyle = 'rgba(35, 26, 18, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y, 9 * z, 3.4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isMe) {
      ctx.strokeStyle = teamColor(a.team);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(x, y - bob);
    ctx.rotate(a.moving ? Math.sin(step) * 0.05 : 0);
    // 걷는 쪽을 보도록, 그림이 원래 향한 쪽과 다르면 뒤집는다
    ctx.scale(a.facing === (LOOK_FACING[a.look] ?? 1) ? 1 : -1, 1);
    if (ok(img)) ctx.drawImage(img, -w / 2, -h + 2 * z, w, h);
    ctx.restore();

    this.label(a.name, x, y - h - 8, 18, isMe ? INK : teamColor(a.team), isMe ? 5 : 3);
  }

  private queueLabels(f: Frame) {
    const z = this.zoom;
    for (const s of SITES) {
      const near = f.nearId === s.id, target = f.targets.has(s.id);
      if (!near && !target) continue;
      const at = s.points ? s.door : s.icon;
      const [x, y] = this.toScreen(at[0], at[1]);
      this.label(s.name, x, y + 10, near ? 21 : 19, target ? RED : INK, near ? 5 : 4, true);
    }
    for (const p of PUMPS) {
      const near = f.nearId === 'pump:' + p.id;
      const target = p.isBroad && f.targets.has('pump');
      if (!near && !target && !(p.isBroad && z < 1.2)) continue;
      const [x, y] = this.toScreen(p.x, p.y);
      this.label(p.name, x, y + 10, near ? 21 : 19, target ? RED : INK, near || target ? 5 : 2, true);
    }
    if (f.showFog && z > 1.1) {
      for (const m of MIASMA) {
        const [x, y] = this.toScreen(m.x, m.y);
        this.label(m.name, x, y, 17, '#4d5a14', 1);
      }
    }
  }

  private label(str: string, x: number, y: number, size: number, color: string, prio: number, top = false) {
    this.labels.push({ str, x, y, size, color, top, prio });
  }

  /**
   * 지도 위 글자는 상자 없이 종이색 테두리만 둘러 읽히게 한다.
   * 서로 겹치면 중요한 글자를 먼저 놓고, 나머지는 위아래로 비켜 놓거나(자리가 없으면) 생략한다.
   */
  private flushLabels() {
    const ctx = this.ctx;
    const placed: [number, number, number, number][] = [];
    this.labels.sort((a, b) => b.prio - a.prio);
    for (const l of this.labels) {
      ctx.font = `700 ${l.size}px ${FONT}`;
      const w = ctx.measureText(l.str).width + 8, h = l.size + 6;
      const x0 = Math.max(4, Math.min(this.vw - w - 4, l.x - w / 2));
      const base = l.top ? l.y : l.y - h;
      let y0 = NaN;
      for (const dy of [0, h, -h, h * 2, -h * 2, h * 3]) {
        const y = base + (l.top ? dy : -dy);
        if (!placed.some(p => x0 < p[0] + p[2] && x0 + w > p[0] && y < p[1] + p[3] && y + h > p[1])) { y0 = y; break; }
      }
      if (Number.isNaN(y0)) continue;
      placed.push([x0, y0, w, h]);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = PAPER;
      ctx.strokeText(l.str, x0 + w / 2, y0 + h / 2);
      ctx.fillStyle = l.color;
      ctx.fillText(l.str, x0 + w / 2, y0 + h / 2);
    }
  }
}
