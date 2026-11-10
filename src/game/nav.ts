import { WORLD_SCALE } from '../data/story.ts';

/**
 * 고지도에서 뽑아낸 거리 마스크 위를 걷게 한다.
 * walk_mask.png 의 픽셀값 = 벽까지의 거리(x36). 0 은 건물 블록.
 */
export class Nav {
  private w = 0;
  private h = 0;
  private d = new Uint8Array(0);
  // A* 작업 버퍼 (한 번만 할당하고 세대 번호로 초기화를 대신한다)
  private g = new Float32Array(0);
  private from = new Int32Array(0);
  private seen = new Uint32Array(0);
  private gen = 0;
  public ready = false;

  public async load(url: string) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = this.w = img.naturalWidth;
    c.height = this.h = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, this.w, this.h).data;
    const n = this.w * this.h;
    this.d = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.d[i] = px[i * 4];
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.ready = true;
  }

  private cell(wx: number, wy: number): number {
    const x = Math.floor(wx / WORLD_SCALE), y = Math.floor(wy / WORLD_SCALE);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }

  public walkable(wx: number, wy: number): boolean {
    const i = this.cell(wx, wy);
    return i >= 0 && this.d[i] > 0;
  }

  /** 가장 가까운 보행 가능 지점(월드 좌표). 없으면 null */
  public snap(wx: number, wy: number, maxCells = 70): [number, number] | null {
    const cx = Math.floor(wx / WORLD_SCALE), cy = Math.floor(wy / WORLD_SCALE);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= maxCells && best < 0; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
          const i = y * this.w + x;
          // 벽에 바짝 붙은 칸은 피한다
          if (this.d[i] < 50) continue;
          const dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = i; }
        }
      }
    }
    if (best < 0) return null;
    return [(best % this.w + 0.5) * WORLD_SCALE, (Math.floor(best / this.w) + 0.5) * WORLD_SCALE];
  }

  /** 벽을 따라 미끄러지는 이동. 소호의 길은 대부분 비스듬해서 축 분리 방식으로는 자꾸 걸린다 */
  public slide(x: number, y: number, dx: number, dy: number): [number, number] {
    for (const a of SLIDE_ANGLES) {
      const c = Math.cos(a), s = Math.sin(a);
      const nx = x + (dx * c - dy * s) * c, ny = y + (dx * s + dy * c) * c;
      if (this.walkable(nx, ny)) return [nx, ny];
    }
    return [x, y];
  }

  /** 거리를 따라가는 최단 경로(월드 좌표 꼭짓점 목록). 길이 없으면 null */
  public path(ax: number, ay: number, bx: number, by: number): [number, number][] | null {
    const s = this.cell(ax, ay), t = this.cell(bx, by);
    if (s < 0 || t < 0 || !this.d[s] || !this.d[t]) return null;
    const W = this.w, d = this.d, g = this.g, from = this.from, seen = this.seen;
    const gen = ++this.gen;
    const tx = t % W, ty = Math.floor(t / W);
    const heap = new MinHeap();
    g[s] = 0; from[s] = -1; seen[s] = gen;
    heap.push(s, 0);
    let found = false, guard = 0;
    while (heap.size && guard++ < 600000) {
      const cur = heap.pop();
      if (cur === t) { found = true; break; }
      const cx = cur % W, cy = (cur - cx) / W, gc = g[cur];
      for (let k = 0; k < 8; k++) {
        const nx = cx + NX[k], ny = cy + NY[k];
        if (nx < 0 || ny < 0 || nx >= W || ny >= this.h) continue;
        const ni = ny * W + nx;
        const dn = d[ni];
        if (!dn) continue;
        // 길 가장자리는 비싸게: 경로가 길 한가운데로 난다
        const ng = gc + NC[k] * (1 + 60 / dn);
        if (seen[ni] === gen && ng >= g[ni]) continue;
        seen[ni] = gen; g[ni] = ng; from[ni] = cur;
        const hx = Math.abs(nx - tx), hy = Math.abs(ny - ty);
        heap.push(ni, ng + (hx > hy ? hx + 0.4142 * hy : hy + 0.4142 * hx));
      }
    }
    if (!found) return null;
    const cells: number[] = [];
    for (let c = t; c !== -1; c = from[c]) cells.push(c);
    cells.reverse();
    // 일직선으로 보이는 구간은 꼭짓점을 덜어 낸다
    const out: [number, number][] = [];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!this.clearLine(cells[anchor], cells[i])) {
        anchor = i - 1;
        out.push(this.toWorld(cells[anchor]));
      }
    }
    out.push([bx, by]);
    return out;
  }

  private toWorld(i: number): [number, number] {
    return [(i % this.w + 0.5) * WORLD_SCALE, (Math.floor(i / this.w) + 0.5) * WORLD_SCALE];
  }

  private clearLine(a: number, b: number): boolean {
    const W = this.w;
    const ax = a % W, ay = Math.floor(a / W), bx = b % W, by = Math.floor(b / W);
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let i = 1; i < n; i++) {
      const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n);
      if (this.d[y * W + x] < 60) return false;
    }
    return true;
  }
}

const SLIDE_ANGLES = [0, 0.4, -0.4, 0.8, -0.8, 1.15, -1.15, 1.4, -1.4];
const NX = [1, -1, 0, 0, 1, 1, -1, -1];
const NY = [0, 0, 1, -1, 1, -1, 1, -1];
const NC = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  public get size() { return this.ids.length; }

  public push(id: number, key: number) {
    const ids = this.ids, keys = this.keys;
    let i = ids.length;
    ids.push(id); keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      ids[i] = ids[p]; keys[i] = keys[p];
      i = p;
    }
    ids[i] = id; keys[i] = key;
  }

  public pop(): number {
    const ids = this.ids, keys = this.keys;
    const top = ids[0];
    const id = ids.pop()!, key = keys.pop()!;
    const n = ids.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= key) break;
        ids[i] = ids[c]; keys[i] = keys[c];
        i = c;
      }
      ids[i] = id; keys[i] = key;
    }
    return top;
  }
}
