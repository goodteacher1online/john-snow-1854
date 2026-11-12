/**
 * 반 전체 연락 창 (hub.html). 영역 대표의 기기가 숨은 창으로 연다.
 *
 * 연결 서비스는 한 방에 스무 명 가까이 모이면 끊긴다. 그래서 학생들은 영역마다 따로 방을 쓰고,
 * 영역마다 대표 한 명만 이 창으로 '반 전체 방'에 들어온다. 그 방에는 다섯 명 남짓뿐이다.
 * 대표는 자기 영역의 기록을 올리고, 모든 영역의 기록을 모아 부모 창(게임)에 돌려준다.
 *
 *   부모 → 이 창: { type: 'area', records: string[] }
 *   이 창 → 부모: { type: 'class', areas: Record<영역, string[]> }
 */
import { insertCoin, onPlayerJoin, myPlayer, PlayerState } from 'playroomkit';

interface AreaState { team: string; records: string[] }

const params = new URLSearchParams(location.search);
const room = params.get('room') ?? '';
const team = params.get('area') ?? '';
const players = new Map<string, PlayerState>();
let ready = false;
let pending: string[] | null = null;

window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.data?.type !== 'area') return;
  pending = e.data.records as string[];
  if (ready) flush();
});

function flush() {
  if (!pending) return;
  myPlayer().setState('area', { team, records: pending } satisfies AreaState, true);
  pending = null;
}

function report() {
  const areas: Record<string, string[]> = {};
  for (const p of players.values()) {
    const s = p.getState('area') as AreaState | undefined;
    if (!s) continue;
    const set = new Set([...(areas[s.team] ?? []), ...s.records]);   // 대표가 바뀌는 사이 둘이 있어도 합친다
    areas[s.team] = [...set];
  }
  parent.postMessage({ type: 'class', areas }, location.origin);
}

async function main() {
  if (!room || !team || parent === window) return;
  await insertCoin({ skipLobby: true, roomCode: room, maxPlayersPerRoom: 20 });
  onPlayerJoin(p => {
    players.set(p.id, p);
    p.onQuit(() => players.delete(p.id));
  });
  ready = true;
  flush();
  setInterval(report, 1500);
}

main().catch(err => console.warn('[반 전체 연락] 연결하지 못함:', err));
