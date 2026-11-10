import { Avatar, RemotePlayer, Site } from '../types.ts';
import { SITES, PUMPS, MIASMA, WORLD_W, WORLD_H, teamColor } from '../data/story.ts';

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
  path: [number, number][] | null;
  handleRemoved: boolean;
  showFog: boolean;
  showCatchment: boolean;
  board: boolean;
  time: number;
}

/** 세로로 긴 건물 그림 크기(월드 단위) */
const ICON_SIZE = { house: [28, 48], brewery: [68, 62], workhouse: [104, 96] } as const;
const AVATAR_H = 44;
const PUMP_H = 44;

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
  private map = load('./assets/soho_map.webp');
  private catchment = load('./assets/catchment.png');
  private pump = load('./assets/pump.webp');
  private pumpNoHandle = load('./assets/pump_no_handle.webp');
  private chars = { male: load('./assets/characters/player_male.webp'), female: load('./assets/characters/player_female.webp') };
  private icons = {
    house: load('./assets/houses/house_terrace.webp'),
    brewery: load('./assets/houses/house_brewery.webp'),
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

  /** 화면 좌표가 가리키는 조사 장소(건물 그림이나 문) */
  public siteAt(sx: number, sy: number): Site | null {
    const [wx, wy] = this.toWorld(sx, sy);
    for (const s of SITES) {
      const [iw, ih] = ICON_SIZE[s.kind];
      const inIcon = Math.abs(wx - s.icon[0]) < iw / 2 + 4 && wy < s.icon[1] + 4 && wy > s.icon[1] - ih - 4;
      if (inIcon || Math.hypot(wx - s.door[0], wy - s.door[1]) < 16) return s;
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
    if (f.path) this.drawPath(f);

    for (const s of SITES) this.drawDoor(s, f);

    // 아래쪽에 있는 것이 위를 덮도록 y 순서로 그린다
    const sprites: { y: number; draw: () => void }[] = [];
    for (const s of SITES) sprites.push({ y: s.icon[1], draw: () => this.drawSite(s, f) });
    for (const p of PUMPS) sprites.push({ y: p.y, draw: () => this.drawPump(p.x, p.y, p.isBroad && f.handleRemoved) });
    for (const o of f.others) sprites.push({ y: o.y, draw: () => this.drawAvatar(o, false, f.time) });
    sprites.push({ y: f.me.y, draw: () => this.drawAvatar(f.me, true, f.time) });
    sprites.sort((a, b) => a.y - b.y);
    for (const s of sprites) s.draw();

    this.drawLabels(f);
    if (!f.board) this.drawTargetArrows(f);
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

  private drawPath(f: Frame) {
    const ctx = this.ctx, path = f.path!;
    ctx.save();
    ctx.strokeStyle = 'rgba(35, 26, 18, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([2, 9]);
    ctx.lineCap = 'round';
    ctx.lineDashOffset = -f.time * 24;
    ctx.beginPath();
    ctx.moveTo(...this.toScreen(f.me.x, f.me.y));
    for (const p of path) ctx.lineTo(...this.toScreen(p[0], p[1]));
    ctx.stroke();
    ctx.setLineDash([]);
    const [ex, ey] = this.toScreen(...path[path.length - 1]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(ex, ey, 7 + Math.sin(f.time * 6) * 2, 0, Math.PI * 2);
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
    const r = Math.max(4, 5 * this.zoom);
    if (target) {
      const pulse = (f.time * 0.9) % 1;
      ctx.strokeStyle = RED;
      ctx.globalAlpha = 1 - pulse;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r + pulse * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = done ? INK : PAPER;
    ctx.fill();
    ctx.lineWidth = 2;
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
    const ctx = this.ctx, z = this.zoom;
    const [iw, ih] = ICON_SIZE[s.kind];
    const [x, y] = this.toScreen(s.icon[0], s.icon[1]);
    if (x < -150 || y < -80 || x > this.vw + 150 || y > this.vh + 300) return;
    const w = iw * z, h = ih * z;

    ctx.fillStyle = 'rgba(35, 26, 18, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.56, Math.max(3, h * 0.06), 0, 0, Math.PI * 2);
    ctx.fill();

    const near = f.nearId === s.id;
    const img = this.icons[s.kind];
    if (ok(img)) {
      if (near) { ctx.shadowColor = 'rgba(255, 244, 214, 0.95)'; ctx.shadowBlur = 16; }
      ctx.drawImage(img, x - w / 2, y - h, w, h);
      ctx.shadowBlur = 0;
    }

    // 스노우의 지도처럼 사망자 한 명에 검은 막대 하나
    const mine = f.records.has(s.id);
    if (!mine && !(f.board && f.classRecords.has(s.id))) return;
    const bw = 12 * z, bh = 2.6 * z, pitch = 4 * z, perCol = 9;
    const left = x - w / 2 - 5 * z - bw;
    ctx.fillStyle = INK;
    for (let i = 0; i < s.deaths; i++) {
      const col = Math.floor(i / perCol), row = i % perCol;
      ctx.fillRect(left - col * (bw + 3 * z), y - bh - row * pitch, bw, bh);
    }
    if (s.deaths === 0) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(left + bw / 2, y - 5 * z, 4 * z, 0, Math.PI * 2);
      ctx.stroke();
    }
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

  private drawAvatar(a: Avatar, isMe: boolean, time: number) {
    const ctx = this.ctx, z = this.zoom;
    const [x, y] = this.toScreen(a.x, a.y);
    if (x < -80 || y < -40 || x > this.vw + 80 || y > this.vh + 160) return;
    const img = this.chars[a.gender];
    const h = AVATAR_H * z, w = ok(img) ? h * img.naturalWidth / img.naturalHeight : h * 0.35;
    const step = a.moving ? time * 9 : 0;
    const bob = a.moving ? Math.abs(Math.sin(step)) * 2.2 * z : 0;

    ctx.fillStyle = 'rgba(35, 26, 18, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y, 9 * z, 3.4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isMe) {
      ctx.strokeStyle = teamColor(a.team);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(x, y - bob);
    ctx.rotate(a.moving ? Math.sin(step) * 0.05 : 0);
    // 원본 그림은 왼쪽을 보고 있다. 가는 방향을 보도록 뒤집는다
    ctx.scale(-a.facing, 1);
    if (ok(img)) ctx.drawImage(img, -w / 2, -h + 2 * z, w, h);
    ctx.restore();

    this.text(isMe ? a.name : a.name, x, y - h - 6, { size: 14, color: isMe ? INK : teamColor(a.team) });
  }

  private drawLabels(f: Frame) {
    const z = this.zoom;
    for (const s of SITES) {
      const near = f.nearId === s.id;
      if (!near && !f.targets.has(s.id)) continue;
      const [x, y] = this.toScreen(s.icon[0], s.icon[1]);
      this.text(s.name, x, y + 16, { size: near ? 17 : 15, color: f.targets.has(s.id) ? RED : INK, baseline: 'top' });
    }
    for (const p of PUMPS) {
      const near = f.nearId === 'pump:' + p.id;
      const target = p.isBroad && f.targets.has('pump');
      if (!near && !target && !(p.isBroad && z < 1.2)) continue;
      const [x, y] = this.toScreen(p.x, p.y);
      this.text(p.name, x, y + 8, { size: near ? 17 : 15, color: target ? RED : INK, baseline: 'top' });
    }
    if (f.showFog && z > 1.1) {
      for (const m of MIASMA) {
        const [x, y] = this.toScreen(m.x, m.y);
        this.text(m.name, x, y, { size: 14, color: '#4d5a14' });
      }
    }
  }

  /** 화면 밖에 있는 목표를 가장자리 화살표로 가리킨다 */
  private drawTargetArrows(f: Frame) {
    const ctx = this.ctx;
    const pad = 56, top = 130, bottom = 120;
    const [px, py] = this.toScreen(f.me.x, f.me.y);
    for (const id of f.targets) {
      const s = SITES.find(v => v.id === id);
      const wpos: [number, number] | null = s ? s.door : id === 'pump' ? [PUMPS[0].x, PUMPS[0].y] : null;
      if (!wpos) continue;
      const [tx, ty] = this.toScreen(wpos[0], wpos[1]);
      if (tx > pad && tx < this.vw - pad && ty > top && ty < this.vh - bottom) continue;
      const ang = Math.atan2(ty - py, tx - px);
      // 플레이어에서 목표로 가는 선이 화면 안쪽 테두리와 만나는 점
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const kx = dx > 0 ? (this.vw - pad - px) / dx : dx < 0 ? (pad - px) / dx : Infinity;
      const ky = dy > 0 ? (this.vh - bottom - py) / dy : dy < 0 ? (top - py) / dy : Infinity;
      const k = Math.min(kx, ky);
      const ax = px + dx * k, ay = py + dy * k;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = RED;
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      const name = s ? s.name : PUMPS[0].name;
      this.text(name, Math.max(90, Math.min(this.vw - 90, ax - dx * 34)), ay - dy * 30, { size: 14, color: RED });
    }
  }

  /** 지도 위 글자는 상자 없이 종이색 테두리만 둘러 읽히게 한다 */
  private text(str: string, x: number, y: number, o: { size: number; color: string; baseline?: CanvasTextBaseline }) {
    const ctx = this.ctx;
    ctx.font = `700 ${o.size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = PAPER;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = o.color;
    ctx.fillText(str, x, y);
  }
}
