export interface Pump {
  id: string;
  name: string;
  x: number; // 0 ~ 2200 월드좌표
  y: number; // 0 ~ 2200 월드좌표
  isSource: boolean; // Broad Street 펌프만 true
  description: string;
  handleRemoved?: boolean;
}

export type ClueType = 
  | 'normal' 
  | 'brewery_anomaly' 
  | 'workhouse_anomaly' 
  | 'hampstead_anomaly' 
  | 'suspect_cluster';

export interface House {
  id: string;
  address: string;
  x: number;
  y: number;
  deaths: number;
  primaryPump: string;
  residentName: string;
  residentRole?: string;
  interviewText: string;
  clueType: ClueType;
}

export interface MiasmaMarker {
  id: string;
  name: string;
  x: number;
  y: number;
  note: string;
}

export interface SnowGameData {
  pumps: Pump[];
  houses: House[];
  miasmaMarkers: MiasmaMarker[];
}

export type HatStyle = 'silk_hat' | 'bowler' | 'flat_cap' | 'none';
export type ToolStyle = 'magnifier' | 'notebook' | 'microscope';

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  team: string; // 'team1' ~ 'team5'
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  lastActive: number;
  hatStyle?: HatStyle;
  toolStyle?: ToolStyle;
}

export interface InvestigationRecord {
  houseId: string;
  investigatorName: string;
  team: string;
  deaths: number;
  primaryPump: string;
  timestamp: number;
}

export interface GlobalGameState {
  investigatedHouses: Record<string, InvestigationRecord>; // houseId -> record
  broadStreetHandleRemoved: boolean;
  activeHypothesis: 'miasma' | 'water'; // 초기엔 'miasma'
  currentPhase: 'investigation' | 'voting' | 'victory';
}
