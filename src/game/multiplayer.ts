import { insertCoin, onPlayerJoin, myPlayer, PlayerState as RoomPlayer } from 'playroomkit';
import { Avatar, RemotePlayer } from '../types.ts';

interface Profile { name: string; team: string; gender: 'male' | 'female' }
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

  private peers = new Map<string, { player: RoomPlayer; view: RemotePlayer | null; known: Set<string>; done: boolean }>();
  private lastSend = 0;

  public async connect(room: string, me: Avatar) {
    try {
      await insertCoin({ skipLobby: true, roomCode: room });
      const self = myPlayer();
      self.setState('who', { name: me.name, team: me.team, gender: me.gender } satisfies Profile, true);
      onPlayerJoin(player => {
        if (player.id === self.id) return;
        this.peers.set(player.id, { player, view: null, known: new Set(), done: false });
        player.onQuit(() => this.peers.delete(player.id));
      });
      this.connected = true;
    } catch (err) {
      console.warn('[학급 연결] 연결하지 못해 혼자 조사합니다:', err);
    }
  }

  /** 초당 10번까지만 위치를 보낸다 */
  public sendPosition(a: Avatar) {
    if (!this.connected) return;
    const now = performance.now();
    if (now - this.lastSend < 100) return;
    this.lastSend = now;
    myPlayer().setState('pos', { x: Math.round(a.x), y: Math.round(a.y), f: a.facing, m: a.moving } satisfies Pos, false);
  }

  public sendProgress(records: string[], stage: number) {
    if (!this.connected) return;
    myPlayer().setState('prog', { records, stage } satisfies Progress, true);
  }

  /** 매 프레임 호출: 친구들의 최신 상태를 읽고 위치를 부드럽게 잇는다 */
  public others(): RemotePlayer[] {
    const out: RemotePlayer[] = [];
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
      v.x += (v.tx - v.x) * 0.2;
      v.y += (v.ty - v.y) * 0.2;
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
