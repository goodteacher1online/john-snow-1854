import { Site } from '../types.ts';
import { BROAD_PUMP, REASONING, STAGE, DIST_NEED } from './story.ts';
export { DIST_NEED };

/**
 * 과학자의 탐구력: 관찰·비교·추론·검증 네 가지가 기록과 행동에 따라 자란다.
 * 탐구 배지는 과학자다운 습관(반례 찾기, 그래프로 견주기, 예상하고 확인하기, 가설 고치기)에 준다.
 */

/** 수첩 그래프를 봤는지 */
export type Seen = Partial<Record<'smell' | 'water' | 'dist' | 'table', boolean>>;

export interface InquiryState {
  records: Site[];
  stage: number;
  reasonStep: number;
  misses: number;
  seen: Seen;
  /** 첫 가설 (HYPOTHESES 의 번호) */
  hypo0?: number;
  /** 공기설 시험 전 예상 */
  predict?: number;
  /** 거리 그래프 전 예상 */
  distPredict?: number;
  /** 문을 두드리기 전 예상: 집 id → 1 사망자가 났을 것 / 0 없을 것 */
  preds?: Record<string, number>;
  /** 빗나간 예상이나 예외 사례의 까닭을 밝힌 집 */
  why?: string[];
  /** 위원회 반박을 그래프로 뒷받침한 횟수 */
  strong?: number;
}

/** 예외 사례: 펌프가 코앞인데 무사하거나, 다른 펌프가 더 가까운데 사망자가 난 곳 */
export const anomalyOf = (s: Site): 'near' | 'far' | undefined =>
  s.proves.includes('near') ? 'near' : s.proves.includes('far') ? 'far' : undefined;
/** 마신 물로 사망 여부가 설명되는 집인가 */
export const waterExplains = (s: Site) => (s.deaths > 0) === s.drankBroad;

/** 예상 적중과 예외 사례 */
export function predStats(st: InquiryState) {
  const preds = st.preds ?? {}, why = new Set(st.why ?? []);
  const guessed = st.records.filter(s => preds[s.id] !== undefined);
  const hits = guessed.filter(s => (preds[s.id] === 1) === (s.deaths > 0));
  const missed = guessed.filter(s => (preds[s.id] === 1) !== (s.deaths > 0) && waterExplains(s));
  const odd = (k: 'near' | 'far') => st.records.filter(s => anomalyOf(s) === k);
  return {
    n: guessed.length, hit: hits.length,
    missed: missed.length, learned: missed.filter(s => why.has(s.id)).length,
    near: odd('near').length, nearWhy: odd('near').filter(s => why.has(s.id)).length,
    far: odd('far').length, farWhy: odd('far').filter(s => why.has(s.id)).length,
  };
}

/** 공기설을 시험하기 전에 고르는 첫 가설 */
export const HYPOTHESES = ['냄새가 고약한 곳, 썩은 공기', '가난하고 비좁은 살림', '마시는 물', '아직 모르겠다. 더 보아야 한다'];
export const HYPO_WATER = 2;

/** 거리 그래프를 보기 전에 묻는 예상 */
export const DIST_PREDICT = {
  q: '물이 원인이라면, 브로드 가 펌프에서 멀어질수록 집마다 사망자는 어떻게 되어야 하겠는가?',
  options: ['늘어난다', '줄어든다', '거리와 상관없다'],
  ok: 1,
};

/** 펌프에서의 거리 구간 (월드 단위). 지도 위 직선거리 */
export const DIST_BANDS: { label: string; max: number }[] = [
  { label: '펌프 바로 곁', max: 140 },
  { label: '가까움', max: 300 },
  { label: '조금 멂', max: 500 },
  { label: '멂', max: Infinity },
];
export const distToBroad = (s: Site) => Math.hypot(s.door[0] - BROAD_PUMP.x, s.door[1] - BROAD_PUMP.y);


/** 네 가지 탐구력 (0~100) */
export function skills(st: InquiryState) {
  const n = st.records.length;
  const observe = Math.min(100, Math.round(n * 2));
  const compare = (st.seen.smell ? 25 : 0) + (st.seen.water ? 25 : 0) + (st.seen.dist ? 25 : 0) + (st.seen.table ? 25 : 0);
  const solved = Math.min(st.reasonStep, REASONING.length) / REASONING.length;
  const reason = Math.round(solved * 70 + (solved > 0 ? Math.max(0, 30 - st.misses * 10) : 0));
  const has = (id: string) => st.records.some(s => s.id === id);
  const checks = [has('gould'), has('eley'), has('littlepulteney') || has('carnaby')].filter(Boolean).length;
  const verify = (st.predict !== undefined ? 20 : 0) + (st.distPredict !== undefined ? 20 : 0) + Math.round(checks / 3 * 45) + (st.distPredict === DIST_PREDICT.ok ? 15 : 0);
  return { observe, compare, reason, verify: Math.min(100, verify) };
}
export const SKILL_NAMES: Record<keyof ReturnType<typeof skills>, string> = { observe: '관찰', compare: '비교', reason: '추론', verify: '검증' };

/** 탐구력 수준 1~5 */
export function level(st: InquiryState) {
  const s = skills(st);
  const avg = (s.observe + s.compare + s.reason + s.verify) / 4;
  return { avg: Math.round(avg), lv: Math.min(5, 1 + Math.floor(avg / 20)) };
}
export const LEVEL_NAMES = ['', '호기심 많은 관찰자', '꼼꼼한 기록자', '자료를 견주는 사람', '가설을 시험하는 사람', '역학자'];

/** 탐구 배지 */
export const BADGES: { id: string; name: string; desc: string; test: (st: InquiryState) => boolean }[] = [
  { id: 'first', name: '첫 기록', desc: '처음으로 세 가지를 물어 기록했다', test: st => st.records.length >= 1 },
  { id: 'obs10', name: '발로 뛰는 관찰자', desc: '열 곳을 조사했다', test: st => st.records.length >= 10 },
  { id: 'obs25', name: '꼼꼼한 기록자', desc: '스물다섯 곳을 조사했다', test: st => st.records.length >= 25 },
  { id: 'obs50', name: '지도를 그리는 사람', desc: '쉰 곳을 조사했다', test: st => st.records.length >= 50 },
  { id: 'obs100', name: '스노우처럼', desc: '백 곳을 조사했다. 스노우도 이렇게 집집마다 다녔다', test: st => st.records.length >= 100 },
  { id: 'both', name: '양쪽을 보다', desc: '사망자가 난 집과 무사한 집을 함께 조사했다', test: st => st.records.some(s => s.deaths > 0) && st.records.some(s => s.deaths === 0) },
  { id: 'counter', name: '반례 찾기', desc: '냄새가 고약한데 사망자가 없는 곳을 찾았다', test: st => st.records.some(s => s.smell === 'high' && s.deaths === 0) },
  { id: 'areas', name: '넓게 보기', desc: '세 영역 넘게 걸쳐 조사했다', test: st => new Set(st.records.map(s => s.area ?? 'story')).size >= 4 },
  { id: 'graph', name: '그래프로 견주기', desc: '냄새로, 마시는 물로 묶은 그래프를 둘 다 그렸다', test: st => !!(st.seen.smell && st.seen.water) },
  { id: 'predict', name: '예상하고 확인하기', desc: '조사하기 전에 결과를 예상했다', test: st => st.predict !== undefined && st.stage > STAGE.TEST_AIR },
  { id: 'revise', name: '가설 고치기', desc: '기록이 말하는 대로 처음 가설을 바꾸었다', test: st => st.hypo0 !== undefined && st.hypo0 !== HYPO_WATER && st.stage >= STAGE.PREDICT },
  { id: 'hunch', name: '날카로운 직감', desc: '처음 가설부터 물을 의심했다', test: st => st.hypo0 === HYPO_WATER && st.stage >= STAGE.PREDICT },
  { id: 'clean', name: '한 번에 추리', desc: '추리 문제를 틀리지 않고 풀었다', test: st => st.stage >= STAGE.PREDICT && st.misses === 0 },
  { id: 'dose', name: '거리와 죽음', desc: `기록 ${DIST_NEED}곳 넘게 모아 펌프에서의 거리와 사망을 그래프로 그렸다`, test: st => !!st.seen.dist },
  { id: 'dosehit', name: '맞힌 예상', desc: '거리 그래프의 모양을 미리 맞혔다', test: st => st.distPredict === DIST_PREDICT.ok && !!st.seen.dist },
  { id: 'calib', name: '정확한 예상', desc: '문을 두드리기 전에 열 번 넘게 예상하고 열에 일곱 넘게 맞혔다', test: st => { const p = predStats(st); return p.n >= 10 && p.hit / p.n >= 0.7; } },
  { id: 'learn', name: '틀려도 배운다', desc: '빗나간 예상의 까닭을 세 번 밝혔다', test: st => predStats(st).learned >= 3 },
  { id: 'bounty', name: '예외 사냥꾼', desc: '펌프 곁인데 무사한 집과 멀리서 사망자가 난 집을 둘 다 찾아 까닭을 밝혔다', test: st => { const p = predStats(st); return p.nearWhy > 0 && p.farWhy > 0; } },
  { id: 'strong', name: '강한 증거', desc: '위원회의 세 반론을 모두 그래프로 뒷받침했다', test: st => (st.strong ?? 0) >= 3 },
];
