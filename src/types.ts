export type Smell = 'high' | 'mid' | 'low';
export type QuestionId = 'toll' | 'air' | 'water';
export type PortraitId = 'woman' | 'youth' | 'elder' | 'brewer' | 'widow' | 'official';
export type SiteKind = 'house' | 'brewery' | 'factory' | 'workhouse';
export type PlayerGender = 'male' | 'female';

/** 위원회에서 이 기록이 반박할 수 있는 주장 */
export type Proof = 'smell' | 'near' | 'far';

export interface Site {
  id: string;
  name: string;
  kind: SiteKind;
  /** 월드 좌표(원본 지도 픽셀 x2). 문은 거리 위, icon 은 건물 밑변 가운데 */
  door: [number, number];
  icon: [number, number];
  nearestPump: string;
  npc: { name: string; role: string; portrait: PortraitId; mirror?: boolean };
  people: number;
  deaths: number;
  smell: Smell;
  smellNote: string;
  drankBroad: boolean;
  waterNote: string;
  /** record: 스노우 보고서에 실린 사례 / composite: 당시 기록을 바탕으로 꾸민 가구 */
  basis: 'record' | 'composite';
  proves: Proof[];
  clue?: string;
  /** 위원회에서 이 기록을 내놓으며 하는 말 */
  testimony?: string;
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
  team: string;
  gender: PlayerGender;
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
  gender: PlayerGender;
  team: string;
  room: string;
  stage: number;
  records: string[];
  asked: Record<string, QuestionId[]>;
  xp: number;
  reasonStep: number;
  misses: number;
  noteSeen: number;
  /** 구빈원·양조장을 보기 전에 한 예상 (0: 많이 죽었을 것, 1: 거의 안 죽었을 것) */
  predict?: number;
  x: number;
  y: number;
}
