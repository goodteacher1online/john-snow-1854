import gen from './districts.gen.json';
import people from './district_people.json';
import { Site, Smell, WaterKind, Proof, PortraitId } from '../types.ts';

/**
 * 영역마다 맡아 조사하는 집 8곳과, 사망자가 7명 넘는 큰 집 (tools/build_districts.py 가 스노우의 지도에서 고름).
 * 사망자 수는 공개 자료(Tobler 1994 디지털화, HistData 의 Snow.deaths)에서 그 자리의 값이고, 주민·마신 물·대사는 꾸몄다.
 * 다른 펌프가 더 가까운데 사망자가 난 집은, 스노우가 적은 사정(리틀 말버러 가 펌프 물이 더러워
 * 브로드 가까지 길으러 감, 일터·학교가 브로드 가)대로 브로드 가 물을 마신 것으로 했다.
 * 주민은 본 것만 말한다. 그 물이 원인이라는 해석은 하지 않는다.
 */

interface Gen { id: string; area: string; icon: number[]; door: number[]; bars: boolean; deaths: number; nearestPump: string }
interface Person { id: string; name: string; role: string; home: string }

export interface DistrictCtx {
  w: (p: number[]) => [number, number];
  placeName: (x: number, y: number) => string;
  pumpName: (id: string) => string;
  /** 악취 진원지 (월드 좌표) */
  miasma: { name: string; x: number; y: number }[];
}

/** 받침이 있으면 a, 없으면 b (이/가, 은/는 고르기) */
function josa(word: string, a: string, b: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return b;
  return (c - 0xac00) % 28 ? a : b;
}
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

const GREET = ['조사관이시라고요? 들어오세요.', '무슨 일로 오셨어요?', '교구에서 나오셨다고요. 물어보세요.', '바쁘지만 잠깐이면 괜찮아요.'];
const SICK = ['하루 사이에 쌀뜨물 같은 설사를 하더니 손쓸 틈도 없었어요.', '9월 첫 주말이었어요. 의사를 부르러 간 사이에 숨을 거뒀지요.', '아침까지 멀쩡하던 사람이 저녁에 식어 버렸어요.'];
const WELL = ['이웃 동네 소식을 들으면 무섭기만 해요.', '문을 닫아걸고 지냈지요.', '왜 우리만 무사한지 모르겠어요.'];
const BYE = ['궁금한 게 더 있으면 언제든 오세요.', '원인을 꼭 찾아 주세요.', '몸조심하세요, 조사관님.', '다른 집들도 무사하면 좋겠어요.'];

/** 사망자가 났지만 다른 펌프가 더 가까운 집이 브로드 가 물을 마신 사정 */
const FAR_REASON: { short: string; line: string; why: string }[] = [
  { short: '일터에서 길어 옴', why: '식구가 브로드 가에서 일해', line: '우리 거리 펌프가 더 가깝긴 해요. 그런데 식구 하나가 브로드 가에서 일해서, 일 끝나고 오는 길에 그 펌프 물을 통에 받아 와요.' },
  { short: '아이들이 학교 오가며 마심', why: '아이들이 브로드 가 근처 학교에 다녀', line: '집에선 동네 펌프 물을 써요. 그런데 아이들이 브로드 가 근처 학교에 다니면서 거기 펌프 물을 마셨대요.' },
  { short: '물맛이 좋다고 일부러 길어 옴', why: '물맛이 좋다고 일부러', line: '조금 멀어도 브로드 가 물이 차고 맛있다고 일부러 길어 와요.' },
];

export function buildDistricts(ctx: DistrictCtx): Site[] {
  const who = Object.fromEntries((people.people as Person[]).map(p => [p.id, p]));
  const zeroNearBroad = new Map<string, number>();
  let farIndex = 0;

  return (gen as Gen[]).map((g, i) => {
    const p = who[g.id];
    const door = ctx.w(g.door), icon = ctx.w(g.icon);
    const street = ctx.placeName(door[0], door[1]);
    const name = `${street} ${p.home}`;
    const deaths = g.deaths;
    const peopleCount = deaths > 0 ? deaths + 5 + (i * 7) % 11 : 5 + (i * 5) % 9;

    // 냄새: 악취 진원지 가까이는 심하고, 그 밖은 고르게 나눈다. 사망자가 없는 집 가운데 첫 집은 냄새가 심한 곳으로
    const near = ctx.miasma.find(m => Math.hypot(m.x - icon[0], m.y - icon[1]) < 280);
    let smell: Smell = near ? 'high' : pick<Smell>(['mid', 'low', 'high', 'mid'], i);
    let smellNote = near ? `${near.name} 냄새` : smell === 'high' ? '하수구 악취' : smell === 'mid' ? '하수구 냄새 조금' : '냄새가 덜함';
    if (deaths === 0 && i % 8 === 5) { smell = 'high'; smellNote = '뒷마당 오물통 냄새'; }

    // 마시는 물
    let kind: WaterKind, short: string, note: string, waterLine: string, why = '';
    if (deaths > 0 && g.nearestPump === 'broad') {
      kind = 'broad'; short = '브로드 가 펌프'; note = '브로드 가 펌프, 가까움';
      waterLine = '브로드 가 펌프요. 가깝고 물이 차고 맛있거든요.';
    } else if (deaths > 0 && g.nearestPump === 'little_marlborough') {
      kind = 'broad'; short = '브로드 가 펌프'; note = '리틀 말버러 가 펌프 물이 고약해 브로드 가까지 감';
      why = '리틀 말버러 가 펌프 물에서 냄새가 나서';
      waterLine = '가까운 건 리틀 말버러 가 펌프인데 물에서 고약한 냄새가 나요. 그래서 다들 브로드 가까지 길으러 가요.';
    } else if (deaths > 0) {
      const r = FAR_REASON[farIndex++ % FAR_REASON.length];
      kind = 'broad'; short = '브로드 가 펌프'; note = `브로드 가 펌프, ${r.short}`; why = r.why; waterLine = r.line;
    } else if (g.nearestPump === 'broad') {
      const k = (zeroNearBroad.get(g.area) ?? 0);
      zeroNearBroad.set(g.area, k + 1);
      if (k === 0) {
        kind = 'broad'; short = '브로드 가 펌프'; note = '브로드 가 펌프, 가까움';
        waterLine = '브로드 가 펌프 물을 마셔요. 그래도 우리 식구는 다 무사했어요.';
      } else {
        kind = 'pipe'; short = '수도 회사 물'; note = '수도 회사에서 들어오는 물';
        waterLine = '수도 회사에서 들어오는 물을 써요. 브로드 가 펌프가 가깝긴 한데 그 물은 길어 오지 않아요.';
      }
    } else {
      kind = 'pump'; short = ctx.pumpName(g.nearestPump); note = `${short}, 가까움`;
      waterLine = `${short} 물을 써요. 가까우니까요.`;
    }

    // 위원회에서 쓸 수 있는 기록
    const proves: Proof[] = [];
    let clue: string | undefined;
    const testimonies: Partial<Record<Proof, string>> = {};
    if (deaths === 0 && smell === 'high') {
      proves.push('smell');
      clue = `냄새가 고약한데 ${peopleCount}명 모두 무사`;
      testimonies.smell = `${name}입니다. 냄새가 고약하지만 ${peopleCount}명 모두 살아 있습니다. 이 집은 ${short} 물을 마십니다.`;
    }
    if (deaths > 0 && g.nearestPump !== 'broad') {
      proves.push('far');
      clue = `다른 펌프가 더 가까운데 ${deaths}명 사망`;
      testimonies.far = `${name}입니다. 다른 펌프가 더 가깝지만 ${why} 브로드 가 펌프 물을 마셨고 ${deaths}명이 죽었습니다.`;
    }
    if (deaths === 0 && g.nearestPump === 'broad' && kind !== 'broad') {
      proves.push('near');
      clue = '브로드 가 펌프가 가까운데 모두 무사';
      testimonies.near = `${name}입니다. 브로드 가 펌프가 가깝지만 ${short}을 마셔 ${peopleCount}명 모두 무사합니다.`;
    }

    const role = p.role, nm = p.name;
    const site: Site = {
      id: g.id, name, kind: 'house', basis: 'map', proves, clue, testimonies, area: g.area,
      fact: '사망자 수는 스노우 지도의 그 자리 막대 수(공개 디지털화 자료). 주민·마신 물·대사는 꾸밈.',
      npc: { name: nm, role, portrait: `r_${g.id}` as PortraitId },
      people: peopleCount, deaths, smell, smellNote,
      drankBroad: kind === 'broad', waterNote: note, waterKind: kind, waterShort: short,
      door, icon, nearestPump: g.nearestPump,
      intro: [`(${p.home} 문을 두드리자 ${role} ${nm}${josa(nm, '이', '가')} 나온다.)`, pick(GREET, i)],
      toll: [
        '나: 이 집에서 앓은 사람이 있습니까?',
        deaths > 0 ? `${peopleCount}명이 사는데 ${deaths}명이 죽었어요.` : `${peopleCount}명이 사는데 다행히 아무도 앓지 않았어요.`,
        deaths > 0 ? pick(SICK, i) : pick(WELL, i),
      ],
      air: [
        '나: 집 주변 공기는 어떻습니까?',
        smell === 'high' ? `${smellNote}가 지독해요. 여름엔 창을 못 열지요.` : smell === 'mid' ? '다른 동네와 비슷하게 하수구 냄새가 조금 나요.' : '이 거리는 냄새가 덜한 편이에요.',
      ],
      water: ['나: 마실 물은 어디서 길어 옵니까?', waterLine],
      outro: pick(BYE, i),
    };
    return site;
  });
}
