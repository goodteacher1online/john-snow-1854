import { Avatar, RemotePlayer } from '../types.ts';

interface Profile { name: string; team: string; look: string }
interface Pos { x: number; y: number; f: 1 | -1; m: boolean }
interface Progress { records: string[]; stage: number }

interface PeerEntry {
  profile?: Profile;
  pos?: Pos;
  prog?: Progress;
  view: RemotePlayer | null;
  known: Set<string>;
  done: boolean;
}

const DEFAULT_RELAY_URL = 'wss://classroom-relay.classroom-relay.workers.dev';
const CONNECT_TIMEOUT_MS = 6000;
const RECONNECT_DELAYS_MS = [1500, 3000, 6000, 12000];

function resolveRelayBase(): string {
  const fromQuery = typeof location !== 'undefined'
    ? new URLSearchParams(location.search).get('relay')
    : null;
  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_RELAY_URL;
  const raw = (fromQuery || fromEnv || DEFAULT_RELAY_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (raw.startsWith('https://')) return 'wss://' + raw.slice(8);
  if (raw.startsWith('http://')) return 'ws://' + raw.slice(7);
  if (raw.startsWith('wss://') || raw.startsWith('ws://')) return raw;
  return '';
}

/**
 * 같은 방 번호로 들어온 학급 친구들의 위치와 조사 진행을 Cloudflare WebSocket으로 나눈다.
 * 연결에 실패하거나 오프라인이어도 게임은 혼자서 끝까지 할 수 있다.
 */
export class Multiplayer {
  public connected = false;
  public onJoin?: (name: string) => void;
  public onRecord?: (name: string, team: string, siteId: string) => void;
  public onFinish?: (name: string) => void;
  public onFail?: () => void;

  private peers = new Map<string, PeerEntry>();
  private lastSend = 0;
  private lastKey = '';
  private myRecords: string[] = [];
  private myStage = 0;
  private ws: WebSocket | null = null;
  private connectSeq = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private failNotified = false;
  private meRef: Avatar | null = null;
  private wsUrl = '';

  /** 다른 영역까지 합친 반 전체 기록: 영역 id → 기록한 곳들 */
  public classAreas: Record<string, string[]> = {};

  /**
   * room: 이 영역의 방, classRoom: 반 전체 방, area: 이 영역 id
   */
  public async connect(room: string, me: Avatar, classRoom = '', area = ''): Promise<void> {
    this.meRef = me;
    this.connectSeq += 1;
    this.reconnectAttempt = 0;
    this.failNotified = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(1000, 'reconnect'); } catch { /* ignore */ }
      this.ws = null;
    }
    this.peers.clear();
    this.connected = false;

    const relayBase = resolveRelayBase();
    if (!relayBase) {
      this.notifyFailOnce('중계 서버 주소가 아직 설정되지 않아 혼자 조사합니다.');
      return;
    }

    const safeRoom = encodeURIComponent(((classRoom || room) || 'default').slice(0, 64));
    const safeTeam = encodeURIComponent((area || 'team1').slice(0, 24));
    this.wsUrl = `${relayBase}/ws/johnsnow/${safeRoom}?team=${safeTeam}`;

    await this.openSocket(this.connectSeq, true);
  }

  private notifyFailOnce(reason: unknown): void {
    if (this.failNotified) return;
    this.failNotified = true;
    console.warn('[학급 연결] 연결하지 못해 혼자 조사합니다:', reason);
    this.onFail?.();
  }

  private sendPacket(t: string, d: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ t, d }));
      } catch { /* ignore */ }
    }
  }

  private getOrCreatePeer(id: string): PeerEntry {
    let entry = this.peers.get(id);
    if (!entry) {
      entry = { view: null, known: new Set(), done: false };
      this.peers.set(id, entry);
    }
    return entry;
  }

  private openSocket(seq: number, isInitial: boolean): Promise<void> {
    return new Promise((resolve) => {
      if (seq !== this.connectSeq || !this.wsUrl) {
        resolve();
        return;
      }

      let settled = false;
      const finishInitial = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };

      const timer = setTimeout(() => {
        if (seq !== this.connectSeq || settled) return;
        if (isInitial) {
          this.notifyFailOnce('연결 시간 초과');
          finishInitial();
        }
      }, CONNECT_TIMEOUT_MS);

      let ws: WebSocket;
      try {
        ws = new WebSocket(this.wsUrl);
      } catch (err) {
        if (isInitial) this.notifyFailOnce(err);
        finishInitial();
        return;
      }

      this.ws = ws;

      ws.addEventListener('open', () => {
        if (seq !== this.connectSeq || this.ws !== ws) return;
        this.connected = true;
        this.reconnectAttempt = 0;
        const me = this.meRef;
        if (me) {
          this.sendPacket('prof', { name: me.name, team: me.team, look: me.look } satisfies Profile);
          this.sendPacket('pos', { x: Math.round(me.x), y: Math.round(me.y), f: me.facing, m: me.moving } satisfies Pos);
          this.lastKey = `${Math.round(me.x)},${Math.round(me.y)},${me.facing},${me.moving}`;
          this.lastSend = performance.now();
        }
        if (this.myRecords.length > 0 || this.myStage > 0) {
          this.sendPacket('prog', { records: this.myRecords, stage: this.myStage } satisfies Progress);
        }
        finishInitial();
      });

      ws.addEventListener('message', (ev) => {
        if (seq !== this.connectSeq || this.ws !== ws) return;
        let msg: {
          t?: string;
          id?: string;
          d?: unknown;
          peers?: Array<{ id?: string; profile?: Profile | null; pos?: Pos | null; prog?: Progress | null }>;
          state?: { areas?: Record<string, string[]> };
          areas?: Record<string, string[]>;
        };
        try {
          msg = JSON.parse(String(ev.data)) as typeof msg;
        } catch {
          return;
        }
        if (!msg || typeof msg.t !== 'string') return;

        switch (msg.t) {
          case 'welcome': {
            if (msg.state?.areas && typeof msg.state.areas === 'object') {
              this.classAreas = { ...msg.state.areas };
            }
            if (Array.isArray(msg.peers)) {
              for (const p of msg.peers) {
                if (!p?.id) continue;
                const entry = this.getOrCreatePeer(p.id);
                if (p.profile) entry.profile = p.profile;
                if (p.pos) entry.pos = p.pos;
                if (p.prog) entry.prog = p.prog;
              }
            }
            break;
          }
          case 'prof': {
            if (!msg.id || !msg.d || typeof msg.d !== 'object') break;
            const entry = this.getOrCreatePeer(msg.id);
            const prof = msg.d as Profile;
            entry.profile = prof;
            if (entry.view) {
              entry.view.name = prof.name;
              entry.view.team = prof.team;
              entry.view.look = prof.look;
            }
            break;
          }
          case 'pos': {
            if (!msg.id || !msg.d || typeof msg.d !== 'object') break;
            const entry = this.getOrCreatePeer(msg.id);
            entry.pos = msg.d as Pos;
            break;
          }
          case 'prog': {
            if (!msg.id || !msg.d || typeof msg.d !== 'object') break;
            const entry = this.getOrCreatePeer(msg.id);
            entry.prog = msg.d as Progress;
            break;
          }
          case 'class': {
            if (msg.areas && typeof msg.areas === 'object') {
              this.classAreas = { ...msg.areas };
            }
            break;
          }
          case 'leave': {
            if (msg.id) this.peers.delete(msg.id);
            break;
          }
        }
      });

      ws.addEventListener('error', () => {
        if (seq !== this.connectSeq || this.ws !== ws) return;
        if (isInitial && !settled) {
          this.notifyFailOnce('WebSocket 연결 오류');
          finishInitial();
        }
      });

      ws.addEventListener('close', () => {
        if (seq !== this.connectSeq || this.ws !== ws) return;
        this.ws = null;
        this.connected = false;
        if (isInitial && !settled) {
          this.notifyFailOnce('WebSocket 연결 종료');
          finishInitial();
        }
        if (this.reconnectAttempt < RECONNECT_DELAYS_MS.length) {
          const delay = RECONNECT_DELAYS_MS[this.reconnectAttempt++];
          this.reconnectTimer = setTimeout(() => {
            if (seq === this.connectSeq) void this.openSocket(seq, false);
          }, delay);
        }
      });
    });
  }

  /**
   * 위치는 달라졌을 때만 초당 4회(250ms)까지 보낸다. 서 있을 때는 5초에 한 번만 보낸다.
   */
  public sendPosition(a: Avatar): void {
    if (!this.connected) return;
    const now = performance.now();
    if (now - this.lastSend < 250) return;
    const key = `${Math.round(a.x)},${Math.round(a.y)},${a.facing},${a.moving}`;
    if (key === this.lastKey && now - this.lastSend < 5000) return;
    this.lastSend = now;
    this.lastKey = key;
    this.sendPacket('pos', { x: Math.round(a.x), y: Math.round(a.y), f: a.facing, m: a.moving } satisfies Pos);
  }

  public sendProgress(records: string[], stage: number): void {
    this.myRecords = [...records];
    this.myStage = stage;
    if (!this.connected) return;
    this.sendPacket('prog', { records: this.myRecords, stage } satisfies Progress);
  }

  /** 매 프레임 호출: 친구들의 최신 상태를 읽고 위치를 부드럽게 잇는다 */
  public others(): RemotePlayer[] {
    const out: RemotePlayer[] = [];
    for (const [id, peer] of this.peers) {
      const profile = peer.profile;
      const pos = peer.pos;
      if (!profile || !pos) continue;
      const prog = peer.prog ?? { records: [], stage: 0 };
      if (!peer.view) {
        peer.view = { id, ...profile, x: pos.x, y: pos.y, tx: pos.x, ty: pos.y, facing: pos.f, moving: pos.m, records: [], stage: 0 };
        prog.records.forEach(r => peer.known.add(r)); // 들어오기 전 기록은 속보로 띄우지 않는다
        peer.done = prog.stage >= 6;
        this.onJoin?.(profile.name);
      }
      const v = peer.view;
      v.tx = pos.x; v.ty = pos.y; v.facing = pos.f; v.moving = pos.m;
      v.x += (v.tx - v.x) * 0.12;
      v.y += (v.ty - v.y) * 0.12;
      v.records = prog.records; v.stage = prog.stage;
      for (const r of prog.records) {
        if (!peer.known.has(r)) {
          peer.known.add(r);
          this.onRecord?.(v.name, v.team, r);
        }
      }
      if (prog.stage >= 6 && !peer.done) {
        peer.done = true;
        this.onFinish?.(v.name);
      }
      out.push(v);
    }
    return out;
  }
}
