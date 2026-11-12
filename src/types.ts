export type Smell = 'high' | 'mid' | 'low';
export type QuestionId = 'toll' | 'air' | 'water';
/** tools/gen_portraits.py 가 만든 흉상 파일 이름 */
export type PortraitId =
  | 'sarah' | 'ned' | 'maryann' | 'keeper' | 'sam' | 'huggins' | 'master' | 'scholar' | 'foreman'
  | 'jack' | 'ellen' | 'abe' | 'harriet' | 'hugh' | 'chairman' | 'physician'
  | `r_d${string}`;          // 영역 조사 집 40곳의 주민
export type SiteKind = 'house' | 'brewery' | 'factory' | 'workhouse';
/** 조사관 모습: f1~f6, m1~m6 (tools/gen_investigators.py) */
export type Look = string;

/** 위원회에서 이 기록이 반박할 수 있는 주장 */
export type WaterKind = 'broad' | 'pump' | 'pipe' | 'well' | 'none';
export type Proof = 'smell' | 'near' | 'far';

export interface Site {
  id: string;
  name: string;
  kind: SiteKind;
  /** 월드 좌표(원본 지도 픽셀 x2). 문은 거리 위, icon 은 건물 밑변 가운데 */
  door: [number, number];
  icon: [number, number];
  nearestPump: string;
  npc: { name: string; role: string; portrait: PortraitId };
  people: number;
  deaths: number;
  smell: Smell;
  smellNote: string;
  drankBroad: boolean;
  waterNote: string;
  /** 기록판에 적는 물의 출처와 그 갈래 */
  waterKind: WaterKind;
  waterShort: string;
  /** record: 스노우 보고서에 실린 사례 / composite: 당시 기록을 바탕으로 꾸민 가구 */
  basis: 'record' | 'composite' | 'map';
  /** 영역 조사 집이면 그 영역 id */
  area?: string;
  proves: Proof[];
  clue?: string;
  /** 기록에 남은 사례에서 무엇이 원전 그대로이고 무엇을 꾸몄는지 */
  fact?: string;
  /** 위원회에서 이 기록을 내놓으며 하는 말 */
  testimony?: string;
  /** 한 집이 여러 반박에 쓰일 때, 반박마다 다른 말 */
  testimonies?: Partial<Record<Proof, string>>;
  intro: string[];
  toll: string[];
  air: string[];
  water: string[];
  outro: string;
}

export interface Pump {
  id: string;
  name: string;
  x: number;
  y: number;
  isBroad: boolean;
}

export interface Avatar {
  id: string;
  name: string;
  /** 함께 할 때 고른 영역 (AREAS 의 id) */
  team: string;
  look: Look;
  x: number;
  y: number;
  facing: 1 | -1;
  moving: boolean;
}

export interface RemotePlayer extends Avatar {
  tx: number;
  ty: number;
  records: string[];
  stage: number;
}

export interface SaveData {
  name: string;
  look: Look;
  /** 함께 할 때 고른 영역 (AREAS 의 id) */
  team: string;
  room: string;
  stage: number;
  records: string[];
  asked: Record<string, QuestionId[]>;
  xp: number;
  reasonStep: number;
  misses: number;
  noteSeen: number;
  /** 지난번에 시작한 방과 영역. 바뀌면 새 영역의 시작 장소에서 출발한다 */
  startKey?: string;
  /** 구빈원·양조장을 보기 전에 한 예상 (0: 많이 죽었을 것, 1: 거의 안 죽었을 것) */
  predict?: number;
  x: number;
  y: number;
}
