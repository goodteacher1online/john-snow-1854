import { insertCoin, onPlayerJoin, myPlayer, getState, setState, isHost } from 'playroomkit';
import { PlayerState, InvestigationRecord, PlayerGender, HatStyle, ToolStyle } from '../types.ts';

export class MultiplayerManager {
  public isConnected = false;
  public myId = 'local_investigator';
  public myTeam = 'team1';
  public myColor = '#3b82f6';
  public otherPlayers: Map<string, PlayerState> = new Map();

  // 이벤트 콜백
  public onInvestigationUpdated?: (records: Record<string, InvestigationRecord>) => void;
  public onHandleRemoved?: () => void;
  public onHypothesisChanged?: (hypothesis: 'miasma' | 'water') => void;

  private lastPosSendTime = 0;

  public async init(
    roomId: string,
    playerName: string,
    team: string,
    hatStyle: HatStyle = 'silk_hat',
    toolStyle: ToolStyle = 'magnifier',
    gender: PlayerGender = 'male'
  ) {
    this.myTeam = team;
    try {
      // 팀에 따른 고유 색상 배정
      const TEAM_COLORS: Record<string, string> = {
        team1: '#2563eb', // 브로드 가 수사대 (청색)
        team2: '#16a34a', // 케임브리지 가 수사대 (녹색)
        team3: '#d97706', // 골든 스퀘어 수사대 (호박색)
        team4: '#9333ea', // 폴랜드 가 수사대 (보라색)
        team5: '#dc2626'  // 햄스테드 특수 수사대 (적색)
      };
      this.myColor = TEAM_COLORS[team] || '#4b5563';

      await insertCoin({
        gameId: `john-snow-1854-${roomId}`,
        discord: false,
        skipLobby: true
      });

      this.isConnected = true;
      const me = myPlayer();
      this.myId = me.id;

      // 내 프로필 설정 (성별, 모자, 도구 포함)
      me.setState('profile', {
        name: playerName,
        team: this.myTeam,
        color: this.myColor,
        hatStyle,
        toolStyle,
        gender
      }, true);

      // 다른 플레이어 참가 리스너
      onPlayerJoin((player) => {
        if (player.id === this.myId) return;

        player.onQuit(() => {
          this.otherPlayers.delete(player.id);
        });
      });

      // 전역 상태 감시 (가구 조사 목록 동기화)
      setInterval(() => {
        const investigations = getState('investigations') || {};
        if (this.onInvestigationUpdated) {
          this.onInvestigationUpdated(investigations);
        }

        const handleRemoved = getState('broad_handle_removed') || false;
        if (handleRemoved && this.onHandleRemoved) {
          this.onHandleRemoved();
        }

        const hypothesis = getState('active_hypothesis') || 'miasma';
        if (this.onHypothesisChanged) {
          this.onHypothesisChanged(hypothesis);
        }
      }, 500);

      console.log('[Multiplayer] Playroom Kit 연결 성공. ID:', this.myId);
    } catch (err) {
      console.warn('[Multiplayer] Playroom Kit 연결 실패 또는 오프라인 모드 실행:', err);
      this.isConnected = false;
    }
  }

  // 10Hz 위치 전송 (100ms 간격)
  public sendMyPosition(x: number, y: number) {
    if (!this.isConnected) return;
    const now = Date.now();
    if (now - this.lastPosSendTime < 100) return; // 10Hz 캡
    this.lastPosSendTime = now;

    try {
      myPlayer().setState('pos', { x, y, t: now }, false); // unreliable
    } catch (e) {
      // 무시
    }
  }

  // 다른 플레이어들의 보간된 위치 가져오기
  public updateAndGetOtherPlayers(): PlayerState[] {
    if (!this.isConnected) return [];

    // Playroom의 모든 플레이어 순회
    // 실제 구현에서는 각 player.getState('pos')와 getState('profile')을 읽어 보간
    const result: PlayerState[] = [];
    this.otherPlayers.forEach((p) => {
      // 선형 보간 (targetX/Y -> x/y)
      if (p.targetX !== undefined && p.targetY !== undefined) {
        p.x += (p.targetX - p.x) * 0.2;
        p.y += (p.targetY - p.y) * 0.2;
      }
      result.push(p);
    });

    return result;
  }

  // 가구 조사 결과 전송 (Reliable 저빈도)
  public recordInvestigation(record: InvestigationRecord) {
    const current = (this.isConnected ? getState('investigations') : {}) || {};
    current[record.houseId] = record;

    if (this.isConnected) {
      setState('investigations', current, true);
    }
    if (this.onInvestigationUpdated) {
      this.onInvestigationUpdated(current);
    }
  }

  // 가설 변경 전송
  public switchHypothesis(hypo: 'miasma' | 'water') {
    if (this.isConnected) {
      setState('active_hypothesis', hypo, true);
    }
    if (this.onHypothesisChanged) {
      this.onHypothesisChanged(hypo);
    }
  }

  // 브로드 펌프 손잡이 제거 전송
  public removeBroadPumpHandle() {
    if (this.isConnected) {
      setState('broad_handle_removed', true, true);
    }
    if (this.onHandleRemoved) {
      this.onHandleRemoved();
    }
  }
}
