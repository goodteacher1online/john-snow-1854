import gen from './districts.gen.json';
import people from './district_people.json';
import { Site, Smell, WaterKind, Proof, PortraitId } from '../types.ts';
import { voiceOf, victims, fill, hashOf, pickAt, SYMPTOM, STREET_DEAD, STREET_WELL } from './voices.ts';

/**
 * 영역마다 맡아 조사하는 집 8곳과, 사망자가 7명 넘는 큰 집 (tools/build_districts.py 가 스노우의 지도에서 고름).
 * 사망자 수는 공개 자료(Tobler 1994 디지털화, HistData 의 Snow.deaths)에서 그 자리의 값이고, 주민·마신 물·대사는 꾸몄다.
 * 다른 펌프가 더 가까운데 사망자가 난 집은, 스노우가 적은 사정(리틀 말버러 가 펌프 물이 더러워
 * 브로드 가까지 길으러 감, 일터·학교가 브로드 가)대로 브로드 가 물을 마신 것으로 했다.
 * 주민은 본 것만 말한다. 그 물이 원인이라는 해석은 하지 않는다.
 */

interface Gen { id: string; area: string; icon: number[]; door: number[]; bars: boolean; deaths: number; nearestPump: string; assigned?: boolean; points?: number[][] }
interface Person { id: string; name: string; role: string; home: string; female?: boolean }

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

const ASK_TOLL = ['나: 이 집에서 앓은 사람이 있습니까?', '나: 이번 콜레라로 이 집에서 앓은 분이 있습니까?', '나: 식구들은 모두 무사하십니까?'];
const ASK_AIR = ['나: 집 주변 공기는 어떻습니까?', '나: 이 거리 냄새는 어떻습니까?', '나: 집 안팎에 고약한 냄새가 납니까?'];
const ASK_WATER = ['나: 마실 물은 어디서 길어 옵니까?', '나: 식구들이 마시는 물은 어디 물입니까?', '나: 물은 어느 펌프에서 받아 옵니까?'];
const SMELL_BELIEF = ['다들 그 냄새가 병을 옮긴다고들 해요.', '독기가 올라온다고, 밤에는 창을 꼭 닫으래요.'];

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

    const hv = (salt: number) => hashOf(g.id, salt);
    // 마시는 물
    let kind: WaterKind, short: string, note: string, waterLine: string, why = '';
    if (deaths > 0 && g.nearestPump === 'broad') {
      kind = 'broad'; short = '브로드 가 펌프'; note = '브로드 가 펌프, 가까움';
      waterLine = pickAt(['브로드 가 펌프요. 가깝고 물이 차고 맛있거든요.', '브로드 가 펌프에서 길어 와요. 몇 걸음이면 되니까요.',
        '당연히 브로드 가 펌프지요. 이 동네 사람들은 다 거기 물을 마셔요.', '브로드 가 펌프 물이요. 여름에도 차가워서 다들 좋아해요.'], hv(30));
    } else if (deaths > 0 && g.nearestPump === 'little_marlborough') {
      kind = 'broad'; short = '브로드 가 펌프'; note = '리틀 말버러 가 펌프 물이 고약해 브로드 가까지 감';
      why = '리틀 말버러 가 펌프 물에서 냄새가 나서';
      waterLine = pickAt(['가까운 건 리틀 말버러 가 펌프인데 물에서 고약한 냄새가 나요. 그래서 다들 브로드 가까지 길으러 가요.',
        '리틀 말버러 가 펌프가 코앞이지만 그 물은 냄새가 나서 못 마셔요. 조금 걸어도 브로드 가 펌프로 가요.'], hv(31));
    } else if (deaths > 0 && g.assigned === false) {
      kind = 'broad'; short = '동네 펌프, 가끔 브로드 가 펌프'; note = `${ctx.pumpName(g.nearestPump)}, 가끔 브로드 가 펌프`;
      why = '브로드 가를 지날 때면';
      waterLine = `${ctx.pumpName(g.nearestPump)} 물을 주로 써요. 그래도 브로드 가를 지날 때면 그 펌프에서 물을 받아 마시곤 했어요.`;
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
    // 직업과 사는 곳에 맞춘 말투. 같은 집은 늘 같은 대사가 나오도록 집 id 로 고른다
    const v = voiceOf(role), female = !!p.female;
    const h = (salt: number) => hashOf(g.id, salt);
    const say = (arr: string[], salt: number) => fill(pickAt(arr, h(salt)), v, `${role} ${nm}${josa(nm, '이', '가')}`, p.home);
    const toll = deaths > 0
      ? [pickAt([`${peopleCount}명이 사는데 ${deaths}명이 죽었어요.`, `이 집엔 ${peopleCount}명이 살아요. 그 가운데 ${deaths}명을 잃었어요.`, `${peopleCount}명 가운데 ${deaths}명이 죽었어요.`], h(3)),
        victims(deaths, female, v.aide, h(4)),
        h(5) % 2 ? pickAt(SYMPTOM, h(6)) : say(v.sick, 6),
        ...(h(7) % 3 === 0 ? [pickAt(STREET_DEAD, h(8))] : [])]
      : [pickAt([`${peopleCount}명이 사는데 다행히 아무도 앓지 않았어요.`, `${peopleCount}명 모두 무사해요.`, `이 집 ${peopleCount}명은 아무도 앓지 않았어요.`], h(3)),
        say(v.well, 4),
        ...(h(7) % 2 === 0 ? [pickAt(STREET_WELL, h(8))] : [])];
    const airFact = smell === 'high'
      ? pickAt([`${smellNote}가 지독해요. 여름엔 창을 못 열지요.`, `${smellNote}가 말도 못 해요. 숨을 참고 지나다닐 정도예요.`, `${smellNote} 때문에 머리가 지끈거려요.`], h(15))
      : smell === 'mid'
        ? pickAt(['다른 동네와 비슷하게 하수구 냄새가 조금 나요.', '하수구 냄새가 조금 나지만 소호에선 흔한 일이에요.', '비 온 뒤에는 하수구 냄새가 좀 올라와요.'], h(15))
        : pickAt(['이 거리는 냄새가 덜한 편이에요.', '여기는 바람이 잘 통해서 냄새가 덜해요.', '우리 골목은 그나마 냄새가 덜한 편이에요.'], h(15));
    const air = [airFact,
      ...(smell !== 'low' && h(9) % 2 ? [say(v.air, 10)] : []),
      ...(smell === 'high' && h(11) % 3 === 0 ? [pickAt(SMELL_BELIEF, h(12))] : [])];
    const water = [waterLine, kind === 'pipe' ? '물값이 들지만 집 안 꼭지에서 바로 나오니 편해요.' : say(v.waterUse, 13)];
    const site: Site = {
      id: g.id, name, kind: 'house', basis: 'map', proves, clue, testimonies, area: g.area,
      assigned: g.assigned !== false, points: g.points?.map(ctx.w),
      fact: '사망자 수는 스노우 지도의 그 자리 막대 수(공개 디지털화 자료). 주민·마신 물·대사는 꾸밈.',
      npc: { name: nm, role, portrait: `r_${g.id}` as PortraitId },
      people: peopleCount, deaths, smell, smellNote,
      drankBroad: kind === 'broad', waterNote: note, waterKind: kind, waterShort: short,
      door, icon, nearestPump: g.nearestPump,
      intro: [`(${say(v.scene, 1)})`, say(v.greet, 2)],
      toll: [pickAt(ASK_TOLL, h(20)), ...toll],
      air: [pickAt(ASK_AIR, h(21)), ...air],
      water: [pickAt(ASK_WATER, h(22)), ...water],
      outro: say(v.bye, 14),
    };
    return site;
  });
}
