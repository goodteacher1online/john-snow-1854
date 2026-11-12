import { insertCoin, onPlayerJoin, myPlayer, isHost, getState, setState, PlayerState as RoomPlayer } from 'playroomkit';
import { Avatar, RemotePlayer } from '../types.ts';

interface Profile { name: string; team: string; look: string }
interface Pos { x: number; y: number; f: 1 | -1; m: boolean }
interface Progress { records: string[]; stage: number }

/**
 * 같은 방 번호로 들어온 학급 친구들의 위치와 조사 진행을 나눈다.
 * 연결에 실패해도 게임은 혼자서 끝까지 할 수 있다.
 */
export class Multiplayer {
  public connected = false;
  public onJoin?: (name: string) => void;
  public onRecord?: (name: string, team: string, siteId: string) => void;
  public onFinish?: (name: string) => void;
  public onFail?: () => void;

  private peers = new Map<string, { player: RoomPlayer; view: RemotePlayer | null; known: Set<string>; done: boolean }>();
  private lastSend = 0;
  private lastKey = '';
  private myRecords: string[] = [];
  /** 반 전체 연락 창 (이 기기가 영역 대표일 때만) */
  private hub: HTMLIFrameElement | null = null;
  private hubSent = '';
  /** 다른 영역까지 합친 반 전체 기록: 영역 id → 기록한 곳들 */
  public classAreas: Record<string, string[]> = {};

  /**
   * room: 이 영역의 방, classRoom: 다섯 영역 대표가 모이는 반 전체 방, area: 이 영역 id
   */
  public async connect(room: string, me: Avatar, classRoom = '', area = '') {
    try {
      await insertCoin({ skipLobby: true, roomCode: room, maxPlayersPerRoom: 60 });
      const self = myPlayer();
      self.setState('who', { name: me.name, team: me.team, look: me.look } satisfies Profile, true);
      onPlayerJoin(player => {
        if (player.id === self.id) return;
        this.peers.set(player.id, { player, view: null, known: new Set(), done: false });
        player.onQuit(() => this.peers.delete(player.id));
      });
      this.connected = true;
      if (classRoom) {
        window.addEventListener('message', e => {
          if (e.origin !== location.origin || e.source !== this.hub?.contentWindow || e.data?.type !== 'class') return;
          setState('class', e.data.areas, true);           // 영역 안 모두에게 나눠 준다
        });
        setInterval(() => this.tendHub(classRoom, area), 2000);
      }
    } catch (err) {
      console.warn('[학급 연결] 연결하지 못해 혼자 조사합니다:', err);
      this.onFail?.();
    }
  }

  /**
   * 위치는 달라졌을 때만, 초당 4번까지 보낸다. 유실될 수 있는 빠른 통로(P2P)는 학교 망에서 막히기 쉽고
   * 한 번도 못 받은 친구는 화면에 나타나지 않으므로, 반드시 도착하는 통로로 보낸다.
   */
  public sendPosition(a: Avatar) {
    if (!this.connected) return;
    const now = performance.now();
    if (now - this.lastSend < 250) return;
    const key = `${Math.round(a.x)},${Math.round(a.y)},${a.facing},${a.moving}`;
    if (key === this.lastKey && now - this.lastSend < 5000) return;      // 서 있을 때는 5초에 한 번만
    this.lastSend = now;
    this.lastKey = key;
    myPlayer().setState('pos', { x: Math.round(a.x), y: Math.round(a.y), f: a.facing, m: a.moving } satisfies Pos, true);
  }

  public sendProgress(records: string[], stage: number) {
    this.myRecords = records;
    if (!this.connected) return;
    myPlayer().setState('prog', { records, stage } satisfies Progress, true);
  }

  /** 영역 대표가 되면 반 전체 연락 창을 열고, 대표가 아니게 되면 닫는다. 연 동안은 영역 기록을 올린다 */
  private tendHub(classRoom: string, area: string) {
    const host = isHost();
    if (host && !this.hub) {
      const f = document.createElement('iframe');
      f.src = `./hub.html?room=${encodeURIComponent(classRoom)}&area=${encodeURIComponent(area)}`;
      f.title = '반 전체 연락';
      f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none';
      document.body.append(f);
      this.hub = f;
      this.hubSent = '';
    } else if (!host && this.hub) {
      this.hub.remove();
      this.hub = null;
    }
    if (!this.hub?.contentWindow) return;
    const union = new Set(this.myRecords);
    for (const p of this.peers.values()) {
      const prog = p.player.getState('prog') as Progress | undefined;
      prog?.records.forEach(r => union.add(r));
    }
    const key = [...union].sort().join(',');
    if (key === this.hubSent) return;
    this.hubSent = key;
    this.hub.contentWindow.postMessage({ type: 'area', records: [...union] }, location.origin);
  }

  /** 매 프레임 호출: 친구들의 최신 상태를 읽고 위치를 부드럽게 잇는다 */
  public others(): RemotePlayer[] {
    const out: RemotePlayer[] = [];
    if (this.connected) this.classAreas = (getState('class') as Record<string, string[]> | undefined) ?? {};
    for (const [id, peer] of this.peers) {
      const profile = peer.player.getState('who') as Profile | undefined;
      const pos = peer.player.getState('pos') as Pos | undefined;
      if (!profile || !pos) continue;
      const prog = (peer.player.getState('prog') as Progress | undefined) ?? { records: [], stage: 0 };
      if (!peer.view) {
        peer.view = { id, ...profile, x: pos.x, y: pos.y, tx: pos.x, ty: pos.y, facing: pos.f, moving: pos.m, records: [], stage: 0 };
        prog.records.forEach(r => peer.known.add(r));   // 들어오기 전 기록은 속보로 띄우지 않는다
        peer.done = prog.stage >= 6;
        this.onJoin?.(profile.name);
      }
      const v = peer.view;
      v.tx = pos.x; v.ty = pos.y; v.facing = pos.f; v.moving = pos.m;
      v.x += (v.tx - v.x) * 0.12;
      v.y += (v.ty - v.y) * 0.12;
      v.records = prog.records; v.stage = prog.stage;
      for (const r of prog.records) {
        if (!peer.known.has(r)) { peer.known.add(r); this.onRecord?.(v.name, v.team, r); }
      }
      if (prog.stage >= 6 && !peer.done) { peer.done = true; this.onFinish?.(v.name); }
      out.push(v);
    }
    return out;
  }
}
