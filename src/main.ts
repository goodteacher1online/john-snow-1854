import './style.css';
import rawData from './data/snowData.json';
import { SnowGameData, PlayerState, House, InvestigationRecord } from './types.ts';
import { SohoMapRenderer } from './game/renderer.ts';
import { MultiplayerManager } from './game/multiplayer.ts';
import { sound } from './game/audio.ts';
import { navigator } from './game/navigation.ts';
import { SOHO_STREETS } from './data/streets.ts';
import confetti from 'canvas-confetti';

const gameData = rawData as SnowGameData;

// 과학자 랜덤 닉네임 목록
const SCIENTIST_NAMES = [
  '존 스노우 의사',
  '플로렌스 조사관',
  '아서 왓슨 의사',
  '조셉 리스터 연구원',
  '로베르트 코흐 역학관',
  '루이 파스퇴르 분석관',
  '윌리엄 파 박사',
  '에드윈 채드윅 조사관',
  '새라 베넷 연구원',
  '에드워드 심스 분석관'
];

// DOM 참조
const lobbyEl = document.getElementById('lobby') as HTMLDivElement;
const gameContainerEl = document.getElementById('game-container') as HTMLDivElement;
const canvasEl = document.getElementById('map-canvas') as HTMLCanvasElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const playerNameInput = document.getElementById('player-name') as HTMLInputElement;
const randomNameBtn = document.getElementById('random-name-btn') as HTMLButtonElement;
const teamCards = document.querySelectorAll<HTMLButtonElement>('.team-btn-parchment, .team-btn');
const selectedTeamInput = document.getElementById('selected-team') as HTMLInputElement;
const genderButtons = document.querySelectorAll<HTMLButtonElement>('.gender-btn');
const selectedGenderInput = document.getElementById('selected-gender') as HTMLInputElement;
const roomInput = document.getElementById('room-id') as HTMLInputElement;

// 상단 초대형 메인 퀘스트 & 현재 가설 바 DOM
const mainQuestBar = document.getElementById('main-quest-bar') as HTMLDivElement | null;
const questPhaseTag = document.getElementById('quest-phase-tag') as HTMLSpanElement | null;
const questHypoTag = document.getElementById('quest-hypo-tag') as HTMLSpanElement | null;
const questTitleText = document.getElementById('quest-title-text') as HTMLParagraphElement | null;

// HUD & 알림
const rankTitle = document.getElementById('rank-title') as HTMLSpanElement;
const expText = document.getElementById('exp-text') as HTMLSpanElement;
const progressText = document.getElementById('progress-text') as HTMLSpanElement;
const hypoBtn = document.getElementById('hypo-toggle-btn') as HTMLButtonElement;
const mapToggleBtn = document.getElementById('map-toggle-btn') as HTMLButtonElement;
const guideOpenBtn = document.getElementById('guide-open-btn') as HTMLButtonElement;
const interactionBanner = document.getElementById('interaction-banner') as HTMLDivElement;
const bannerText = document.getElementById('banner-text') as HTMLSpanElement;
const compassArrow = document.getElementById('compass-arrow') as HTMLSpanElement;
const compassLabel = document.getElementById('compass-label') as HTMLSpanElement;

// 토스트
const gameToast = document.getElementById('game-toast') as HTMLDivElement;
const toastCard = document.getElementById('toast-card') as HTMLDivElement;
const toastIcon = document.getElementById('toast-icon') as HTMLSpanElement;
const toastMsg = document.getElementById('toast-msg') as HTMLSpanElement;

// 모달
const briefingModal = document.getElementById('briefing-modal') as HTMLDivElement;
const briefingConfirmBtn = document.getElementById('briefing-confirm-btn') as HTMLButtonElement;
const briefingCloseX = document.getElementById('briefing-close-x') as HTMLButtonElement;

// 신규 추가: 보로노이 도보권역, 대형 관제 스크린, 모순 카운터, 티커
const voronoiToggleBtn = document.getElementById('voronoi-toggle-btn') as HTMLButtonElement | null;
const bigscreenToggleBtn = document.getElementById('bigscreen-toggle-btn') as HTMLButtonElement | null;
const anomalyCounterText = document.getElementById('anomaly-counter-text') as HTMLElement | null;
const liveTickerContainer = document.getElementById('live-ticker-container') as HTMLDivElement | null;
const screenFlashOverlay = document.getElementById('screen-flash-overlay') as HTMLDivElement | null;
const hatStyleSelect = document.getElementById('hat-style-select') as HTMLSelectElement | null;
const toolStyleSelect = document.getElementById('tool-style-select') as HTMLSelectElement | null;

// 첨부 이미지 레퍼런스 게임 컨트롤 바 & 지역 명패
const fullscreenBtn = document.getElementById('fullscreen-btn') as HTMLButtonElement | null;
const soundToggleBtn = document.getElementById('sound-toggle-btn') as HTMLButtonElement | null;
const lampToggleBtn = document.getElementById('lamp-toggle-btn') as HTMLButtonElement | null;
const currentLocationText = document.getElementById('current-location-text') as HTMLSpanElement | null;

// ★ [첨부 이미지 레퍼런스] 비주얼 노벨 RPG 대화창 DOM
const rpgDialogueContainer = document.getElementById('rpg-dialogue-container') as HTMLDivElement;
const rpgDialogueBox = document.getElementById('rpg-dialogue-box') as HTMLDivElement;
const dialoguePlayerImg = document.getElementById('dialogue-player-img') as HTMLImageElement;
const dialogueNpcImg = document.getElementById('dialogue-npc-img') as HTMLImageElement;
const dialogueSpeakerName = document.getElementById('dialogue-speaker-name') as HTMLSpanElement;
const dialogueDeathTag = document.getElementById('dialogue-death-tag') as HTMLDivElement;
const dialogueText = document.getElementById('dialogue-text') as HTMLParagraphElement;
const dialogueRecordBtn = document.getElementById('dialogue-record-btn') as HTMLButtonElement;
const dialogueCloseBtn = document.getElementById('dialogue-close-btn') as HTMLButtonElement;
const dialogueNextArrow = document.getElementById('dialogue-next-arrow') as HTMLDivElement;

const endingModal = document.getElementById('ending-modal') as HTMLDivElement;
const endingCloseBtn = document.getElementById('ending-close-btn') as HTMLButtonElement;

// 역학 수첩 모달 (3단계 시나리오 개연성 반영)
const notebookBtn = document.getElementById('notebook-btn') as HTMLButtonElement;
const notebookModal = document.getElementById('notebook-modal') as HTMLDivElement;
const notebookCloseBtn = document.getElementById('notebook-close-btn') as HTMLButtonElement;
const nbPhaseBadge = document.getElementById('nb-phase-badge') as HTMLSpanElement;
const nbTitle = document.getElementById('nb-title') as HTMLHeadingElement;
const nbHouseCount = document.getElementById('nb-house-count') as HTMLElement;
const nbDeathCount = document.getElementById('nb-death-count') as HTMLElement;
const nbCurrentHypo = document.getElementById('nb-current-hypo') as HTMLElement;
const nbLogSection = document.getElementById('nb-log-section') as HTMLDivElement;
const nbRecordsList = document.getElementById('nb-records-list') as HTMLDivElement;
const nbAnomalySection = document.getElementById('nb-anomaly-section') as HTMLDivElement;
const nbAnomalies = document.getElementById('nb-anomalies') as HTMLElement;
const nbStatsSection = document.getElementById('nb-stats-section') as HTMLDivElement;
const nbPumpStats = document.getElementById('nb-pump-stats') as HTMLElement;
const nbDecisionSection = document.getElementById('nb-decision-section') as HTMLDivElement;
const switchWaterHypoBtn = document.getElementById('switch-water-hypo-btn') as HTMLButtonElement;

// 초기 랜덤 이름
function rollRandomName() {
  const chosen = SCIENTIST_NAMES[Math.floor(Math.random() * SCIENTIST_NAMES.length)];
  playerNameInput.value = chosen;
}
rollRandomName();
randomNameBtn.addEventListener('click', rollRandomName);

// 모둠 원클릭 탭
teamCards.forEach(card => {
  card.addEventListener('click', () => {
    teamCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const team = card.dataset.team || 'team1';
    selectedTeamInput.value = team;
  });
});

// 성별 선택 원클릭 탭
genderButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    genderButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const gender = (btn.dataset.gender as PlayerGender) || 'male';
    if (selectedGenderInput) selectedGenderInput.value = gender;
  });
});

// 수사 지침서 닫기
function closeBriefing() {
  briefingModal.classList.remove('active');
}
briefingConfirmBtn.addEventListener('click', closeBriefing);
briefingCloseX.addEventListener('click', closeBriefing);
guideOpenBtn.addEventListener('click', () => briefingModal.classList.add('active'));

// 게임 상태 및 경험치
let totalExp = 0;
let currentHouseNear: House | null = null;
let currentInvestigations: Record<string, InvestigationRecord> = {};
let isBroadHandleRemoved = false;
let currentHypothesis: 'miasma' | 'water' = 'miasma';
let isPlayerMoving = false;
let footstepCooldown = 0;

// 내 플레이어 상태
const myPlayer: PlayerState = {
  id: 'me',
  name: '존 스노우 의사',
  color: '#2563eb',
  team: 'team1',
  x: 1200,
  y: 920,
  lastActive: Date.now()
};

// 렌더러 & 멀티플레이어 매니저
const renderer = new SohoMapRenderer(canvasEl, gameData);
const multiplayer = new MultiplayerManager();

// 토스트 메시지 띄우기
let toastTimer = 0;
function showToast(msg: string, icon = '✨', isWarning = false) {
  toastIcon.textContent = icon;
  toastMsg.textContent = msg;
  if (isWarning) {
    toastCard.className = 'px-6 py-3.5 rounded-2xl bg-red-950 text-red-200 border-2 border-red-500 shadow-2xl font-serif font-black text-base flex items-center gap-2.5 animate-pulse';
  } else {
    toastCard.className = 'px-6 py-3 rounded-2xl bg-stone-900 text-amber-300 border-2 border-amber-500 shadow-2xl font-serif font-bold text-base flex items-center gap-2';
  }
  gameToast.classList.remove('opacity-0', '-translate-y-4');
  gameToast.classList.add('opacity-100', 'translate-y-0');

  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    gameToast.classList.remove('opacity-100', 'translate-y-0');
    gameToast.classList.add('opacity-0', '-translate-y-4');
  }, 3500);
}

// 실시간 학급 수사 속보 티커 (Live Ticker) 팝업
function postLiveTicker(msg: string, teamColor = '#3b82f6') {
  if (!liveTickerContainer) return;

  const card = document.createElement('div');
  card.className = 'px-4 py-2.5 rounded-xl bg-stone-900/95 text-stone-100 border border-stone-700 shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold transition-all duration-300 transform translate-x-8 opacity-0';
  card.style.borderLeft = `4px solid ${teamColor}`;
  card.innerHTML = `<span class="shrink-0 text-amber-400">📡</span> <span>${msg}</span>`;

  liveTickerContainer.prepend(card);

  // 나타나기 애니메이션
  requestAnimationFrame(() => {
    card.classList.remove('translate-x-8', 'opacity-0');
    card.classList.add('translate-x-0', 'opacity-100');
  });

  // 4초 후 사라지기
  setTimeout(() => {
    card.classList.remove('translate-x-0', 'opacity-100');
    card.classList.add('translate-x-8', 'opacity-0');
    setTimeout(() => card.remove(), 400);
  }, 4200);
}

// 결정적 모순 발견 시 황금빛 화면 플래시 연출 (Screen Flash Effect)
function flashScreen() {
  if (!screenFlashOverlay) return;
  screenFlashOverlay.classList.remove('opacity-0');
  screenFlashOverlay.classList.add('opacity-100');
  setTimeout(() => {
    screenFlashOverlay.classList.remove('opacity-100');
    screenFlashOverlay.classList.add('opacity-0');
  }, 450);
}

// 보로노이 보행권역 토글 함수
function toggleVoronoi() {
  renderer.showVoronoi = !renderer.showVoronoi;
  if (voronoiToggleBtn) {
    if (renderer.showVoronoi) {
      voronoiToggleBtn.className = 'hud-btn bg-purple-900 text-purple-100 border-purple-400 text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow ring-2 ring-purple-400';
      showToast("📐 1854 존 스노우 원본 '도보 최단거리 권역(Voronoi Polygon)'을 표시합니다!", "🗺️");
    } else {
      voronoiToggleBtn.className = 'hud-btn bg-stone-900/90 text-purple-200 border-purple-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow';
      showToast("📐 도보권역 표시를 껐습니다.", "🗺️");
    }
  }
}
voronoiToggleBtn?.addEventListener('click', toggleVoronoi);

// ==========================================
// 상단 인게임 액션 바 (첨부 이미지 우측 상단 레퍼런스 연동)
// ==========================================
// 1. 전체 화면 토글
fullscreenBtn?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    fullscreenBtn.classList.add('active');
  } else {
    document.exitFullscreen().catch(() => {});
    fullscreenBtn.classList.remove('active');
  }
});

// 2. 소리 On/Off 토글
let isAudioEnabled = true;
soundToggleBtn?.addEventListener('click', () => {
  isAudioEnabled = !isAudioEnabled;
  sound.enabled = isAudioEnabled;
  if (isAudioEnabled) {
    soundToggleBtn.classList.add('active');
    soundToggleBtn.querySelector('span')!.textContent = '소리';
    showToast('🔊 효과음이 켜졌습니다.', '🔊');
  } else {
    soundToggleBtn.classList.remove('active');
    soundToggleBtn.querySelector('span')!.textContent = '음소거';
    showToast('🔇 효과음이 음소거되었습니다.', '🔇');
  }
});

// 3. 거리 가스등 조명 온/오프
let isLampActive = true;
lampToggleBtn?.addEventListener('click', () => {
  isLampActive = !isLampActive;
  renderer.showGasLamps = isLampActive;
  lampToggleBtn.classList.toggle('active', isLampActive);
  showToast(isLampActive ? '💡 거리 가스등을 켰습니다.' : '🌙 거리 가스등을 껐습니다.', '💡');
});

// 4. 현재 위치 명패 실시간 감지 (고지도 실측 좌표 100% 반영)
function updateCurrentLocationBadge() {
  if (!currentLocationText) return;

  const px = myPlayer.x;
  const py = myPlayer.y;

  // 1) 주요 랜드마크 근접 판정
  if (Math.hypot(px - 1409, py - 928) < 110) {
    currentLocationText.textContent = '라이온 맥주 양조장';
    return;
  }
  if (Math.hypot(px - 1066, py - 756) < 110) {
    currentLocationText.textContent = '세인트 제임스 구빈원';
    return;
  }
  if (Math.hypot(px - 1234, py - 944) < 90) {
    currentLocationText.textContent = '브로드 스트리트 펌프';
    return;
  }
  if (Math.hypot(px - 1050, py - 1500) < 140) {
    currentLocationText.textContent = '골든 스퀘어 광장';
    return;
  }

  // 2) 24개 도로 중 가장 가까운 도로 탐색
  let nearestStreetName = '소호 중심가';
  let minStreetDist = 9999;

  for (const street of SOHO_STREETS) {
    for (let i = 0; i < street.points.length - 1; i++) {
      const [x1, y1] = street.points[i];
      const [x2, y2] = street.points[i + 1];
      const dist = distToSegment(px, py, x1, y1, x2, y2);
      if (dist < minStreetDist) {
        minStreetDist = dist;
        nearestStreetName = street.name;
      }
    }
  }

  currentLocationText.textContent = nearestStreetName;
}

// 5. 상단 초대형 메인 퀘스트 & 현재 가설 바 실시간 동기화
function updateMainQuestBar() {
  if (!questPhaseTag || !questHypoTag || !questTitleText) return;

  if (isBroadHandleRemoved) {
    questPhaseTag.textContent = '수사 완수: 역학의 승리';
    questHypoTag.textContent = '콜레라 종식';
    questTitleText.textContent = '브로드 가 펌프의 손잡이를 성공적으로 분리하여 소호의 역병을 멈추었습니다!';
    return;
  }

  if (currentHypothesis === 'water_borne') {
    questPhaseTag.textContent = '제3단계 역사적 결단';
    questHypoTag.textContent = '오염된 식수원 감염설 입증됨';
    questTitleText.textContent = '브로드 가 공공 펌프로 이동하여 오염된 펌프 손잡이를 분리하십시오! [Space]';
    return;
  }

  // 모순 가구 발견 여부 집계 (house_15, house_16, house_17)
  const anomaliesFound = ['house_15', 'house_16', 'house_17'].filter(id => !!currentInvestigations[id]).length;

  if (anomaliesFound > 0) {
    questPhaseTag.textContent = '제2단계 가설의 모순';
    questHypoTag.textContent = '나쁜 공기설의 치명적 결함 발견!';
    questTitleText.textContent = `공기설과 모순되는 증언 발견(${anomaliesFound}/3개)! 역학 수첩(N)을 열어 데이터를 분석하고 식수원 가설로 전환하십시오.`;
    return;
  }

  const count = Object.keys(currentInvestigations).length;
  questPhaseTag.textContent = '제1단계 긴급 수사 퀘스트';
  questHypoTag.textContent = '현재 당국의 공식 가설: 나쁜 공기설';
  questTitleText.textContent = `소호 거리를 수색하여 집들을 인터뷰하고, 악취가 원인인지 현장 데이터를 수집하라! (${count}/20 가구)`;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// 대형 스크린 / 전자칠판 관제 모드 토글 함수
function toggleBigScreen() {
  renderer.isBigScreenMode = !renderer.isBigScreenMode;
  if (bigscreenToggleBtn) {
    if (renderer.isBigScreenMode) {
      bigscreenToggleBtn.className = 'hud-btn bg-emerald-900 text-emerald-100 border-emerald-400 text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow ring-2 ring-emerald-400';
      showToast("📺 [학급 대형 상황판 모드] 소호 전경과 모든 조사관을 한 화면에 관제합니다!", "🏫");
    } else {
      bigscreenToggleBtn.className = 'hud-btn bg-stone-900/90 text-emerald-200 border-emerald-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow';
      showToast("📺 개인 조사 시야로 복귀했습니다.", "👤");
    }
  }
}
bigscreenToggleBtn?.addEventListener('click', toggleBigScreen);

// 키보드 조작
const keys: Record<string, boolean> = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

  // 비주얼 노벨 대화창이 열려있을 때 Space 또는 Enter 처리
  if (rpgDialogueContainer.classList.contains('active')) {
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (isTyping) {
        finishTypewriter();
      } else if (currentHouseNear && !currentInvestigations[currentHouseNear.id]) {
        recordCurrentClue();
      } else {
        closeDialogue();
      }
      return;
    }
    if (e.key === 'Escape') {
      closeDialogue();
      return;
    }
  }

  if (e.key === 'e' || e.key === 'E') {
    checkHouseInteraction();
  }
  if (e.key === ' ' || e.code === 'Space') {
    checkPumpInteraction();
  }
  if (e.key === 'm' || e.key === 'M') {
    toggleFullMap();
  }
  if (e.key === 'n' || e.key === 'N') {
    toggleNotebook();
  }
  if (e.key === 'v' || e.key === 'V') {
    toggleVoronoi();
  }
  if (e.key === 'F10') {
    e.preventDefault();
    toggleBigScreen();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// 모바일 D-Pad
const dpadButtons = document.querySelectorAll<HTMLButtonElement>('.dpad-btn');
dpadButtons.forEach(btn => {
  const dir = btn.dataset.dir;
  if (!dir) return;
  const startMove = () => { keys[dir] = true; };
  const stopMove = () => { keys[dir] = false; };
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); startMove(); });
  btn.addEventListener('touchend', stopMove);
  btn.addEventListener('mousedown', startMove);
  btn.addEventListener('mouseup', stopMove);
});

// 모바일 액션 버튼
const mobileActionBtn = document.getElementById('mobile-action-btn');
mobileActionBtn?.addEventListener('click', () => {
  checkHouseInteraction();
  checkPumpInteraction();
});

// [게임 시작] 버튼 클릭
startBtn.addEventListener('click', async () => {
  const name = playerNameInput.value.trim() || '영국 과학자';
  const team = selectedTeamInput.value || 'team1';
  const roomId = roomInput.value.trim() || '1854';
  const gender = (selectedGenderInput?.value as PlayerGender) || 'male';

  myPlayer.name = name;
  myPlayer.team = team;
  myPlayer.gender = gender;
  myPlayer.hatStyle = (hatStyleSelect?.value as HatStyle) || 'silk_hat';
  myPlayer.toolStyle = (toolStyleSelect?.value as ToolStyle) || 'magnifier';

  const TEAM_COLORS: Record<string, string> = {
    team1: '#2563eb',
    team2: '#16a34a',
    team3: '#d97706',
    team4: '#9333ea',
    team5: '#dc2626'
  };
  myPlayer.color = TEAM_COLORS[team] || '#2563eb';

  // 2200 x 2064 월드 대응 시작 위치 (팀별 소호 거리 요충지 도로변)
  const TEAM_SPAWNS: Record<string, [number, number]> = {
    team1: [1200, 920],  // 브로드 가 40번지 앞 (소호 중심부 브로드 거리)
    team2: [1280, 880],  // 케임브리지 가 길목
    team3: [1160, 910],  // 브로드 가 서쪽 골목길
    team4: [1066, 756],  // 북서쪽 구빈원 앞 도로
    team5: [1409, 928]   // 동쪽 라이온 양조장 앞 도로
  };
  const [sx, sy] = TEAM_SPAWNS[team] || [1200, 920];
  myPlayer.x = sx;
  myPlayer.y = sy;
  renderer.cameraX = sx;
  renderer.cameraY = sy;

  lobbyEl.classList.add('hidden');
  gameContainerEl.classList.remove('hidden');

  // 환영 티커
  postLiveTicker(`[${myPlayer.name}] 조사관님이 소호 수사 본부에 합류했습니다.`, myPlayer.color);

  // 멀티플레이어 연결
  await multiplayer.init(roomId, name, team, myPlayer.hatStyle, myPlayer.toolStyle, myPlayer.gender);

  let prevCount = 0;
  multiplayer.onInvestigationUpdated = (records) => {
    const newCount = Object.keys(records).length;
    if (newCount > prevCount && prevCount > 0) {
      // 새로 조사된 가구 찾기
      const latest = Object.values(records).sort((a, b) => b.timestamp - a.timestamp)[0];
      if (latest) {
        const h = gameData.houses.find(house => house.id === latest.houseId);
        if (h) {
          postLiveTicker(`📝 [${latest.investigatorName}] ${h.address} 조사 완료 (사망 ${h.deaths}명)`, myPlayer.color);
        }
      }
    }
    prevCount = newCount;
    currentInvestigations = records;
    updateProgressUI();
  };
  multiplayer.onHandleRemoved = () => {
    if (!isBroadHandleRemoved) {
      isBroadHandleRemoved = true;
      triggerVictory();
    }
  };
  multiplayer.onHypothesisChanged = (hypo) => {
    currentHypothesis = hypo;
    updateHypothesisUI();
  };

  requestAnimationFrame(gameLoop);
});

// 목적지 클릭 이동 (Click-to-Move) 상태
let targetDestination: { x: number; y: number } | null = null;

// 캔버스 클릭 시 부드러운 자유 이동 및 목적지 설정
canvasEl.addEventListener('click', (e) => {
  if (rpgDialogueContainer.classList.contains('active')) return;
  const rect = canvasEl.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const [worldX, worldY] = renderer.screenToWorld(mouseX, mouseY);

  targetDestination = { x: worldX, y: worldY };
});

// 키보드 조작 시 클릭 이동 취소
window.addEventListener('keydown', () => {
  targetDestination = null;
});

// 메인 게임 루프
let lastLoopTime = performance.now();
function gameLoop(now: number) {
  const dt = Math.min(50, now - lastLoopTime);
  lastLoopTime = now;

  const speed = 0.25 * dt; // 차분하고 품격 있는 영국 신사/숙녀의 보행 속도
  let moveX = 0;
  let moveY = 0;

  // 1. 키보드 입력 우선 검사 (WASD / 화살표)
  if (keys['w'] || keys['arrowup']) moveY -= speed;
  if (keys['s'] || keys['arrowdown']) moveY += speed;
  if (keys['a'] || keys['arrowleft']) moveX -= speed;
  if (keys['d'] || keys['arrowright']) moveX += speed;

  if (moveX !== 0 || moveY !== 0) {
    targetDestination = null; // 키보드 입력 시 마우스 클릭 이동 즉시 해제
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }
  } else if (targetDestination) {
    // 2. 마우스 클릭 목적지 부드러운 직행 이동 (Click-to-Move)
    const distToTarget = Math.hypot(targetDestination.x - myPlayer.x, targetDestination.y - myPlayer.y);
    if (distToTarget > 6) {
      const step = Math.min(distToTarget, speed);
      moveX = ((targetDestination.x - myPlayer.x) / distToTarget) * step;
      moveY = ((targetDestination.y - myPlayer.y) / distToTarget) * step;
    } else {
      targetDestination = null;
    }
  }

  isPlayerMoving = (moveX !== 0 || moveY !== 0);

  if (isPlayerMoving) {
    // 100% 매끄러운 자유 이동 (맵 밖 이탈 방지 클램핑만 수행)
    const [resolvedX, resolvedY] = navigator.resolveMove(myPlayer.x, myPlayer.y, moveX, moveY);
    
    myPlayer.x = resolvedX;
    myPlayer.y = resolvedY;
    multiplayer.sendMyPosition(myPlayer.x, myPlayer.y);

    footstepCooldown -= dt;
    if (footstepCooldown <= 0) {
      sound.playFootstep();
      footstepCooldown = 240;
    }
  }

  updateInteractionBanner();
  updateCompass();
  updateCurrentLocationBadge();
  updateMainQuestBar();

  const otherPlayers = multiplayer.updateAndGetOtherPlayers();
  renderer.render(myPlayer, otherPlayers, currentInvestigations, isBroadHandleRemoved, isPlayerMoving, targetDestination);

  requestAnimationFrame(gameLoop);
}

// 상호작용 배너
function updateInteractionBanner() {
  let targetHouse: House | null = null;
  let minDist = 115; // 줌 2.4에 맞춰 넉넉하고 쾌적한 상호작용 거리 보장

  for (const house of gameData.houses) {
    const dist = Math.hypot(house.x - myPlayer.x, house.y - myPlayer.y);
    if (dist < minDist) {
      minDist = dist;
      targetHouse = house;
    }
  }
  currentHouseNear = targetHouse;

  const broadPump = gameData.pumps.find(p => p.isSource);
  const distToPump = broadPump ? Math.hypot(broadPump.x - myPlayer.x, broadPump.y - myPlayer.y) : 999;
  const investigatedCount = Object.keys(currentInvestigations).length;

  if (distToPump < 65 && !isBroadHandleRemoved) {
    if (investigatedCount >= 8) {
      bannerText.textContent = "🚨 [결단의 시간] 8가구 이상 조사 완료! [스페이스바]로 브로드 펌프 손잡이를 분리하세요!";
    } else {
      bannerText.textContent = `⚠️ 브로드 펌프 앞입니다. 아직 구청을 설득할 데이터가 부족합니다! (현재: ${investigatedCount}/8 가구 조사)`;
    }
    interactionBanner.classList.remove('opacity-0', 'translate-y-6', 'scale-95');
    interactionBanner.classList.add('opacity-100', 'translate-y-0', 'scale-100');
  } else if (currentHouseNear) {
    const isDone = !!currentInvestigations[currentHouseNear.id];
    bannerText.textContent = isDone 
      ? `✅ [${currentHouseNear.address}] 조사가 완료된 가구입니다.` 
      : `[${currentHouseNear.address}] 문 앞입니다! [E] 키를 눌러 인터뷰하세요!`;
    interactionBanner.classList.remove('opacity-0', 'translate-y-6', 'scale-95');
    interactionBanner.classList.add('opacity-100', 'translate-y-0', 'scale-100');
  } else {
    interactionBanner.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
    interactionBanner.classList.add('opacity-0', 'translate-y-6', 'scale-95');
  }
}

interactionBanner?.addEventListener('click', () => {
  checkHouseInteraction();
  checkPumpInteraction();
});

// 나침반 내비게이션
function updateCompass() {
  let closestHouse: House | null = null;
  let minDist = 9999;

  for (const h of gameData.houses) {
    if (!currentInvestigations[h.id]) {
      const dist = Math.hypot(h.x - myPlayer.x, h.y - myPlayer.y);
      if (dist < minDist) {
        minDist = dist;
        closestHouse = h;
      }
    }
  }

  if (closestHouse) {
    const dx = closestHouse.x - myPlayer.x;
    const dy = closestHouse.y - myPlayer.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    compassArrow.style.transform = `rotate(${angle}deg)`;
    compassLabel.textContent = `다음 가구: ${Math.round(minDist)}m (${closestHouse.address})`;
  } else {
    compassArrow.style.transform = 'rotate(0deg)';
    compassLabel.textContent = '모든 가구 조사 완료! 브로드 펌프로 가세요!';
  }
}

// 가구 인터뷰 열기 (돋보기 인스펙션 줌인 연출)
function checkHouseInteraction() {
  if (rpgDialogueContainer.classList.contains('active')) return;
  if (!currentHouseNear) return;

  sound.playDoorKnock();
  renderer.targetZoom = 2.4; // 돋보기 줌인!
  openInterviewModal(currentHouseNear);
}

// 펌프 손잡이 제거 (8가구 이상 조사 시 잠금 해제)
function checkPumpInteraction() {
  const broadPump = gameData.pumps.find(p => p.isSource);
  if (!broadPump || isBroadHandleRemoved) return;

  const dist = Math.hypot(broadPump.x - myPlayer.x, broadPump.y - myPlayer.y);
  if (dist < 65) {
    const count = Object.keys(currentInvestigations).length;
    if (count < 8) {
      showToast(`⚠️ 구청을 설득하려면 최소 8가구 이상의 현장 역학 조사가 필요합니다! (현재: ${count}/8)`);
      return;
    }
    if (confirm("🚨 [역사적 결단: 존 스노우의 증명]\n충분한 역학 조사 데이터를 확보했습니다!\n브로드 스트리트 펌프의 손잡이를 분리하여 오염된 물 공급을 영구 중단하시겠습니까?")) {
      multiplayer.removeBroadPumpHandle();
    }
  }
}

// ==========================================
// ★ [첨부 이미지 레퍼런스 100% 반영] 비주얼 노벨 RPG 대화 시스템
// ==========================================
let fullDialogueText = '';
let typingIndex = 0;
let isTyping = false;
let typingTimer: any = null;

function startTypewriter(text: string) {
  if (typingTimer) clearInterval(typingTimer);
  fullDialogueText = text;
  typingIndex = 0;
  isTyping = true;
  dialogueText.textContent = '';
  dialogueNextArrow.classList.add('hidden');
  dialogueRecordBtn.classList.add('hidden');

  typingTimer = setInterval(() => {
    if (typingIndex < fullDialogueText.length) {
      dialogueText.textContent += fullDialogueText.charAt(typingIndex);
      typingIndex++;
    } else {
      finishTypewriter();
    }
  }, 22);
}

function finishTypewriter() {
  if (typingTimer) clearInterval(typingTimer);
  dialogueText.textContent = fullDialogueText;
  isTyping = false;
  dialogueNextArrow.classList.remove('hidden');

  if (currentHouseNear) {
    const isAlready = !!currentInvestigations[currentHouseNear.id];
    dialogueRecordBtn.classList.remove('hidden');
    dialogueRecordBtn.disabled = isAlready;
    dialogueRecordBtn.innerHTML = isAlready 
      ? `<span>수첩에 이미 기록된 가구</span>` 
      : `<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg><span>수첩에 단서 기록 (+50 EXP)</span>`;
  }
}

// 대화창 클릭 시 스킵 또는 기록 완료
rpgDialogueBox.addEventListener('click', (e) => {
  // 닫기 버튼이나 기록 버튼 직접 클릭 시 중복 처리 방지
  if ((e.target as HTMLElement).closest('#dialogue-record-btn') || (e.target as HTMLElement).closest('#dialogue-close-btn')) {
    return;
  }
  if (isTyping) {
    finishTypewriter();
  } else if (currentHouseNear && !currentInvestigations[currentHouseNear.id]) {
    recordCurrentClue();
  } else {
    closeDialogue();
  }
});

// 인터뷰 대화창 열기
function openInterviewModal(house: House) {
  // 1. 플레이어 초상화 설정 (완벽한 상반신 바스트샷 포트레이트 연동)
  dialoguePlayerImg.src = myPlayer.gender === 'female' 
    ? './assets/portraits/player_female_bust.png' 
    : './assets/portraits/player_male_bust.png';

  // 2. 다양한 6종의 실제 인물 초상화 매핑 (집마다 다채로운 인물 등장)
  let npcPortrait = './assets/portraits/npc_resident_female.png';
  let speakerTitle = house.residentName || '소호 주민';

  if (house.id === 'house_15') {
    npcPortrait = './assets/portraits/npc_brewery.png';
    speakerTitle = `양조장 수석 인부 (${house.residentName})`;
  } else if (house.id === 'house_16') {
    npcPortrait = './assets/portraits/npc_workhouse.png';
    speakerTitle = `구빈원 총무 (${house.residentName})`;
  } else if (house.id === 'house_17') {
    npcPortrait = './assets/portraits/npc_wealthy_lady.png';
    speakerTitle = `햄스테드 마님의 하녀 (${house.residentName})`;
  } else {
    // 일반 주민 가구: 번호에 따라 노신사 / 청년 일꾼 / 여성 주민으로 다채롭게 분기!
    const houseNum = parseInt(house.id.replace('house_', '')) || 0;
    if (houseNum % 3 === 0) {
      npcPortrait = './assets/portraits/npc_resident_elder.png';
      speakerTitle = `원로 주민 (${house.residentName})`;
    } else if (houseNum % 3 === 1) {
      npcPortrait = './assets/portraits/npc_resident_youth.png';
      speakerTitle = `청년 일꾼 (${house.residentName})`;
    } else {
      npcPortrait = './assets/portraits/npc_resident_female.png';
      speakerTitle = `가정 주민 (${house.residentName})`;
    }
  }

  dialogueNpcImg.src = npcPortrait;
  dialogueSpeakerName.textContent = speakerTitle;

  // 3. 사망자 현황 배지
  if (house.deaths > 0) {
    dialogueDeathTag.textContent = `사망 ${house.deaths}명`;
    dialogueDeathTag.className = 'px-3 py-1 rounded-lg text-xs font-black bg-red-100 text-red-800 border-red-300 shadow-sm';
  } else {
    dialogueDeathTag.textContent = `사망 0명 (전원 무사)`;
    dialogueDeathTag.className = 'px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm';
  }

  // 4. 이상치 발견 시 플래시 및 효과음
  const isAlready = !!currentInvestigations[house.id];
  if (!isAlready) {
    if (house.clueType === 'brewery_anomaly') {
      setTimeout(() => {
        flashScreen();
        sound.playShockAnomaly();
        showToast('⚠️ [결정적 모순 발견] 공기 때문이라면서 왜 맥주 공장(70명)은 0명일까?!', '💥', true);
      }, 200);
    } else if (house.clueType === 'workhouse_anomaly') {
      setTimeout(() => {
        flashScreen();
        sound.playShockAnomaly();
        showToast('⚠️ [결정적 모순 발견] 악취 가득한 구빈원(500명)에 사망자가 거의 없다니?!', '💥', true);
      }, 200);
    } else if (house.clueType === 'hampstead_anomaly') {
      setTimeout(() => {
        flashScreen();
        sound.playShockAnomaly();
        showToast('⚠️ [결정적 모순 발견] 맑은 공기의 시골 저택 마님이 왜 사망했을까?!', '💥', true);
      }, 200);
    }
  }

  // 5. 대화창 활성화 및 타이핑 효과 시작
  rpgDialogueContainer.classList.add('active');
  startTypewriter(`"${house.interviewText}"`);
}

// 수첩에 단서 기록 실행
function recordCurrentClue() {
  if (!currentHouseNear) return;

  sound.playClueRecorded();
  renderer.targetZoom = 1.6;

  totalExp += 50;
  expText.textContent = String(totalExp);
  updateRank();

  const record: InvestigationRecord = {
    houseId: currentHouseNear.id,
    investigatorName: myPlayer.name,
    team: myPlayer.team,
    deaths: currentHouseNear.deaths,
    primaryPump: currentHouseNear.primaryPump,
    timestamp: Date.now()
  };

  multiplayer.recordInvestigation(record);
  closeDialogue();

  // 실시간 학급 속보 및 토스트
  if (currentHouseNear.id === 'house_15') {
    postLiveTicker(`[결정적 모순] 라이온 양조장 인부 70명 사망자 0명! (물 대신 맥주 음용)`, '#f59e0b');
    setTimeout(() => {
      showToast('💡 [역학적 의문 #1] 양조장 인부 70명은 종일 소호 공기를 마시는데 사망자 0명! (맥주/자체 우물 음용)', '💡');
    }, 400);
  } else if (currentHouseNear.id === 'house_16') {
    postLiveTicker(`[결정적 모순] 구빈원 500명 중 사망 단 5명! (자체 우물 사용)`, '#a855f7');
    setTimeout(() => {
      showToast('💡 [역학적 의문 #2] 악취가 가장 심한 구빈원(500명)은 사망자 5명뿐! 악취(공기)가 원인일까요?', '💡');
    }, 400);
  } else if (currentHouseNear.id === 'house_17') {
    postLiveTicker(`[결정적 모순] 5km 밖 전원저택 사망자! (소호 브로드 펌프 물 배달)`, '#ef4444');
    setTimeout(() => {
      showToast('💡 [역학적 의문 #3] 공기 맑은 시골 전원주택의 마님이 소호 브로드 가 물을 배달받아 마신 후 사망했습니다!', '💡');
    }, 400);
  } else {
    postLiveTicker(`[${myPlayer.name}] ${currentHouseNear.address} 조사 완료 (+사망 ${currentHouseNear.deaths}명)`, myPlayer.color);
    showToast(`[${currentHouseNear.address}] 수첩 기록 완료! (+50 EXP)`);
  }

  updateProgressUI();
  updateNotebookUI();
}

function closeDialogue() {
  if (typingTimer) clearInterval(typingTimer);
  isTyping = false;
  rpgDialogueContainer.classList.remove('active');
  renderer.targetZoom = 1.6;
}

dialogueRecordBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  recordCurrentClue();
});

dialogueCloseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  closeDialogue();
});

// ==========================================
// 역학 분석 수첩 (Data Notebook) 시스템
// ==========================================
function toggleNotebook() {
  const isActive = notebookModal.classList.contains('active');
  if (isActive) {
    notebookModal.classList.remove('active');
  } else {
    updateNotebookUI();
    notebookModal.classList.add('active');
  }
}
notebookBtn.addEventListener('click', toggleNotebook);
notebookCloseBtn.addEventListener('click', () => notebookModal.classList.remove('active'));

// 가설 전환 버튼 핸들러
switchWaterHypoBtn.addEventListener('click', () => {
  currentHypothesis = 'water_borne';
  multiplayer.changeHypothesis('water_borne');
  updateHypothesisUI();
  updateNotebookUI();
  sound.playVictory();
  showToast("🌊 가설 전환 성공! '오염된 식수원(Water-borne)'으로 결론을 내렸습니다. 이제 브로드 펌프로 가십시오!", "🔬");
});

// ==========================================
// 역학 분석 수첩 (3단계 시나리오 개연성 & 긴장감 시스템)
// ==========================================
function updateNotebookUI() {
  const investigatedList = Object.values(currentInvestigations);
  const count = investigatedList.length;
  const totalDeaths = investigatedList.reduce((acc, cur) => acc + cur.deaths, 0);

  nbHouseCount.textContent = `${count} / ${gameData.houses.length}`;
  nbDeathCount.textContent = `${totalDeaths} 명`;
  nbCurrentHypo.textContent = currentHypothesis === 'miasma' ? '나쁜 공기설' : '오염된 식수원설';
  nbCurrentHypo.className = currentHypothesis === 'miasma' 
    ? 'text-sm sm:text-base text-stone-900 font-black block mt-0.5' 
    : 'text-sm sm:text-base text-blue-700 font-black block mt-0.5';

  // 1. 현장 방문 기록부 렌더링 (가구 주소 및 진술)
  if (count === 0) {
    nbRecordsList.innerHTML = `<p class="text-stone-500 italic">아직 방문한 가구가 없습니다. 거리의 집들을 방문하여 문을 두드리십시오.</p>`;
  } else {
    nbRecordsList.innerHTML = investigatedList.map(inv => {
      const house = gameData.houses.find(h => h.id === inv.houseId);
      if (!house) return '';
      const deathBadge = house.deaths > 0 
        ? `<span class="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-xs">사망 ${house.deaths}명</span>`
        : `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold text-xs">사망 0명 (무사)</span>`;
      return `
        <div class="p-2.5 rounded-lg bg-white border border-stone-200">
          <div class="flex justify-between items-center mb-1">
            <strong class="text-stone-900 text-sm font-black">${house.address} (${house.residentName})</strong>
            ${deathBadge}
          </div>
          <p class="text-xs text-stone-600 line-clamp-2 italic">"${house.interviewText}"</p>
        </div>
      `;
    }).join('');
  }

  // 2. 발견된 모순점 체크 (양조장, 구빈원, 햄스테드)
  const anomalies: string[] = [];
  if (currentInvestigations['house_15']) {
    anomalies.push('[양조장 70명 전원 무사] 종일 소호 공기를 마시는데 왜 환자가 0명인가? (공짜 맥주와 자체 우물만 음용)');
  }
  if (currentInvestigations['house_16']) {
    anomalies.push('[구빈원 500명 중 사망 5명뿐] 가장 악취가 심한 수용시설인데 왜 멀쩡한가? (자체 우물 사용)');
  }
  if (currentInvestigations['house_17']) {
    anomalies.push('[외곽 햄스테드 마님의 사망] 공기 맑은 시골 전원주택 거주자가 왜 사망했는가? (소호 브로드 가 물을 배달받아 음용)');
  }

  // ==========================================
  // 시나리오 3단계 잠금 해제 (스포일러 완전 차단)
  // ==========================================
  if (count < 5 && anomalies.length === 0) {
    // [제1막: 의혹과 조사 단계]
    nbPhaseBadge.textContent = "제1막: 소호 현장 역학 일지";
    nbTitle.textContent = "소호 긴급 환자 조사 일지";
    nbAnomalySection.classList.add('hidden');
    nbStatsSection.classList.add('hidden');
    nbDecisionSection.classList.add('hidden');
  } else if (count < 8 && anomalies.length >= 1) {
    // [제2막: 모순의 발견 단계]
    nbPhaseBadge.textContent = "제2막: 균열과 모순의 발견";
    nbTitle.textContent = "흔들리는 가설과 수사 일지";
    nbAnomalySection.classList.remove('hidden');
    nbAnomalies.innerHTML = anomalies.map(a => `<li class="font-bold text-stone-900 border-l-2 border-red-500 pl-2">${a}</li>`).join('');
    nbStatsSection.classList.add('hidden');
    nbDecisionSection.classList.add('hidden');
  } else if (count >= 8) {
    // [제3막: 데이터의 진실 및 가설 전복 단계]
    nbPhaseBadge.textContent = "제3막: 결정적 데이터의 진실";
    nbTitle.textContent = "식수 공급원별 교차 데이터 분석";
    nbAnomalySection.classList.remove('hidden');
    nbAnomalies.innerHTML = anomalies.map(a => `<li class="font-bold text-stone-900 border-l-2 border-red-500 pl-2">${a}</li>`).join('');
    nbStatsSection.classList.remove('hidden');
    nbDecisionSection.classList.remove('hidden');

    // 식수 공급원별 집계 렌더링
    let broadDeaths = 0, broadHouses = 0;
    let otherPumpDeaths = 0, otherPumpHouses = 0;
    let ownWellDeaths = 0, ownWellHouses = 0;

    for (const inv of investigatedList) {
      if (inv.primaryPump === 'pump_broad') {
        broadDeaths += inv.deaths;
        broadHouses++;
      } else if (inv.primaryPump === 'own_well') {
        ownWellDeaths += inv.deaths;
        ownWellHouses++;
      } else {
        otherPumpDeaths += inv.deaths;
        otherPumpHouses++;
      }
    }

    const maxDeaths = Math.max(1, broadDeaths, otherPumpDeaths, ownWellDeaths);

    nbPumpStats.innerHTML = `
      <div class="space-y-4 font-sans">
        <!-- 브로드 가 펌프 이용 가구 -->
        <div class="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
          <div class="flex justify-between items-center text-sm font-black text-stone-900 mb-1.5">
            <span class="flex items-center gap-1.5 text-red-600">
              <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              브로드 가 공공 펌프 이용 가구 (${broadHouses}가구)
            </span>
            <span class="text-red-600 text-base font-black">${broadDeaths}명 사망</span>
          </div>
          <div class="w-full bg-stone-200 h-3.5 rounded-full overflow-hidden border border-stone-300">
            <div class="bg-red-600 h-full rounded-full transition-all duration-700" style="width: ${(broadDeaths / maxDeaths) * 100}%"></div>
          </div>
        </div>

        <!-- 타 공공 펌프 이용 가구 -->
        <div class="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
          <div class="flex justify-between items-center text-sm font-bold text-stone-800 mb-1.5">
            <span class="flex items-center gap-1.5 text-stone-700">
              <svg class="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              타 공공 펌프 이용 가구 (${otherPumpHouses}가구)
            </span>
            <span class="text-stone-700">${otherPumpDeaths}명 사망</span>
          </div>
          <div class="w-full bg-stone-200 h-3 rounded-full overflow-hidden border border-stone-300">
            <div class="bg-stone-600 h-full rounded-full transition-all duration-700" style="width: ${(otherPumpDeaths / maxDeaths) * 100}%"></div>
          </div>
        </div>

        <!-- 자체 우물 / 맥주 음용 (양조장, 구빈원) -->
        <div class="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
          <div class="flex justify-between items-center text-sm font-bold text-stone-800 mb-1.5">
            <span class="flex items-center gap-1.5 text-emerald-700">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              자체 우물 및 맥주 음용 (양조장·구빈원, ${ownWellHouses}곳)
            </span>
            <span class="text-emerald-700 font-bold">${ownWellDeaths}명 사망</span>
          </div>
          <div class="w-full bg-stone-200 h-3 rounded-full overflow-hidden border border-stone-300">
            <div class="bg-emerald-600 h-full rounded-full transition-all duration-700" style="width: ${(ownWellDeaths / maxDeaths) * 100}%"></div>
          </div>
        </div>
      </div>
    `;
  }
}

// 등급 갱신
function updateRank() {
  if (totalExp >= 450) {
    rankTitle.textContent = '런던의 영웅';
  } else if (totalExp >= 300) {
    rankTitle.textContent = '수석 역학자';
  } else if (totalExp >= 150) {
    rankTitle.textContent = '예리한 탐정';
  } else {
    rankTitle.textContent = '수습 조사관';
  }
}

// UI 갱신 (진행도 & 3대 모순 카운터)
function updateProgressUI() {
  const count = Object.keys(currentInvestigations).length;
  const total = gameData.houses.length;
  progressText.textContent = `${count} / ${total} 가구`;

  // 3대 핵심 모순 조사 여부 집계
  const hasBrewery = !!currentInvestigations['house_15'];
  const hasWorkhouse = !!currentInvestigations['house_16'];
  const hasHampstead = !!currentInvestigations['house_17'];
  const anomalyCount = (hasBrewery ? 1 : 0) + (hasWorkhouse ? 1 : 0) + (hasHampstead ? 1 : 0);

  if (anomalyCounterText) {
    anomalyCounterText.textContent = `${anomalyCount} / 3개`;
    if (anomalyCount === 3) {
      anomalyCounterText.className = 'text-amber-300 font-black text-sm sm:text-base animate-pulse';
    }
  }

  if (count >= 8 && currentHypothesis === 'miasma') {
    hypoBtn.classList.add('pulse-anim');
  }
}

// 가설 전환
hypoBtn.addEventListener('click', () => {
  const next = currentHypothesis === 'miasma' ? 'water' : 'miasma';
  multiplayer.switchHypothesis(next);
});

function updateHypothesisUI() {
  if (currentHypothesis === 'miasma') {
    hypoBtn.textContent = '가설: 나쁜 공기설';
    hypoBtn.className = 'hud-btn bg-stone-900/90 text-stone-200 border-stone-700 text-xs sm:text-sm font-bold';
    renderer.showMiasmaFog = true;
  } else {
    hypoBtn.textContent = '가설: 오염된 식수원설';
    hypoBtn.className = 'hud-btn bg-stone-800 text-stone-100 border-stone-500 font-black text-xs sm:text-sm';
    renderer.showMiasmaFog = false;
  }
}

// 전체 맵 토글
let isFullMapView = false;
mapToggleBtn?.addEventListener('click', toggleFullMap);
function toggleFullMap() {
  isFullMapView = !isFullMapView;
  if (isFullMapView) {
    renderer.targetZoom = 0.85;
    if (mapToggleBtn) mapToggleBtn.textContent = '맵 확대 (M)';
  } else {
    renderer.targetZoom = 1.6;
    if (mapToggleBtn) mapToggleBtn.textContent = '🗺️ 전체 지도 (M)';
  }
}

// 역사적 승리 연출 (펌프 손잡이 분리 사운드 & 팡파르)
function triggerVictory() {
  sound.playPumpHandleDetach();
  setTimeout(() => sound.playVictoryFanfare(), 320);

  confetti({
    particleCount: 220,
    spread: 120,
    origin: { y: 0.52 }
  });

  postLiveTicker("🚨 [역사적 순간] 브로드 펌프 손잡이가 제거되었습니다! 전염병이 종식됩니다!", "#ef4444");
  endingModal.classList.add('active');
}

endingCloseBtn.addEventListener('click', () => {
  endingModal.classList.remove('active');
});
