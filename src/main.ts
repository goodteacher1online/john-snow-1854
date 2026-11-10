import './style.css';
import rawData from './data/snowData.json';
import { SnowGameData, PlayerState, House, InvestigationRecord } from './types.ts';
import { SohoMapRenderer } from './game/renderer.ts';
import { MultiplayerManager } from './game/multiplayer.ts';
import { sound } from './game/audio.ts';
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
const teamCards = document.querySelectorAll<HTMLButtonElement>('.team-btn');
const selectedTeamInput = document.getElementById('selected-team') as HTMLInputElement;
const roomInput = document.getElementById('room-id') as HTMLInputElement;

// HUD & 알림 배너
const progressText = document.getElementById('progress-text') as HTMLSpanElement;
const hypoBtn = document.getElementById('hypo-toggle-btn') as HTMLButtonElement;
const fogBtn = document.getElementById('fog-toggle-btn') as HTMLButtonElement;
const mapToggleBtn = document.getElementById('map-toggle-btn') as HTMLButtonElement;
const guideOpenBtn = document.getElementById('guide-open-btn') as HTMLButtonElement;
const interactionBanner = document.getElementById('interaction-banner') as HTMLDivElement;
const bannerText = document.getElementById('banner-text') as HTMLSpanElement;
const compassArrow = document.getElementById('compass-arrow') as HTMLSpanElement;
const compassLabel = document.getElementById('compass-label') as HTMLSpanElement;

// 모달
const briefingModal = document.getElementById('briefing-modal') as HTMLDivElement;
const briefingConfirmBtn = document.getElementById('briefing-confirm-btn') as HTMLButtonElement;
const briefingCloseX = document.getElementById('briefing-close-x') as HTMLButtonElement;

const interviewModal = document.getElementById('interview-modal') as HTMLDivElement;
const modalAddress = document.getElementById('modal-address') as HTMLHeadingElement;
const modalResident = document.getElementById('modal-resident') as HTMLParagraphElement;
const modalDeaths = document.getElementById('modal-deaths') as HTMLSpanElement;
const modalText = document.getElementById('modal-text') as HTMLParagraphElement;
const modalRecordBtn = document.getElementById('modal-record-btn') as HTMLButtonElement;
const modalCloseBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;

const endingModal = document.getElementById('ending-modal') as HTMLDivElement;
const endingCloseBtn = document.getElementById('ending-close-btn') as HTMLButtonElement;

// 초기 랜덤 이름 부여
function rollRandomName() {
  const chosen = SCIENTIST_NAMES[Math.floor(Math.random() * SCIENTIST_NAMES.length)];
  playerNameInput.value = chosen;
}
rollRandomName();
randomNameBtn.addEventListener('click', rollRandomName);

// 모둠(팀) 원클릭 선택 카드
teamCards.forEach(card => {
  card.addEventListener('click', () => {
    teamCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const team = card.dataset.team || 'team1';
    selectedTeamInput.value = team;
  });
});

// 미션 브리핑 모달 닫기
function closeBriefing() {
  briefingModal.classList.remove('active');
}
briefingConfirmBtn.addEventListener('click', closeBriefing);
briefingCloseX.addEventListener('click', closeBriefing);
guideOpenBtn.addEventListener('click', () => briefingModal.classList.add('active'));

// 게임 상태
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
  x: 480,
  y: 520,
  lastActive: Date.now()
};

// 렌더러 & 멀티플레이어 매니저
const renderer = new SohoMapRenderer(canvasEl, gameData);
const multiplayer = new MultiplayerManager();

// 키보드 조작
const keys: Record<string, boolean> = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'e' || e.key === 'E') {
    checkHouseInteraction();
  }
  if (e.key === ' ' || e.code === 'Space') {
    checkPumpInteraction();
  }
  if (e.key === 'm' || e.key === 'M') {
    toggleFullMap();
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

// 모바일 액션 버튼 클릭
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

  myPlayer.name = name;
  myPlayer.team = team;

  const TEAM_COLORS: Record<string, string> = {
    team1: '#2563eb',
    team2: '#16a34a',
    team3: '#d97706',
    team4: '#9333ea',
    team5: '#dc2626'
  };
  myPlayer.color = TEAM_COLORS[team] || '#2563eb';

  // 팀별 시작 위치
  const TEAM_SPAWNS: Record<string, [number, number]> = {
    team1: [480, 520], // 브로드 가 중심
    team2: [540, 430], // 케임브리지 가
    team3: [180, 680], // 골든 스퀘어
    team4: [400, 320], // 폴랜드 가
    team5: [160, 200]  // 햄스테드 연락소 부근
  };
  const [sx, sy] = TEAM_SPAWNS[team] || [480, 520];
  myPlayer.x = sx;
  myPlayer.y = sy;
  renderer.cameraX = sx;
  renderer.cameraY = sy;

  lobbyEl.classList.add('hidden');
  gameContainerEl.classList.remove('hidden');

  // 멀티플레이어 초기화
  await multiplayer.init(roomId, name, team);

  multiplayer.onInvestigationUpdated = (records) => {
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

// 메인 게임 루프
let lastLoopTime = performance.now();
function gameLoop(now: number) {
  const dt = Math.min(50, now - lastLoopTime);
  lastLoopTime = now;

  // 1. 이동 처리
  const speed = 0.22 * dt;
  let moveX = 0;
  let moveY = 0;

  if (keys['w'] || keys['arrowup']) moveY -= speed;
  if (keys['s'] || keys['arrowdown']) moveY += speed;
  if (keys['a'] || keys['arrowleft']) moveX -= speed;
  if (keys['d'] || keys['arrowright']) moveX += speed;

  if (moveX !== 0 && moveY !== 0) {
    moveX *= 0.7071;
    moveY *= 0.7071;
  }

  isPlayerMoving = (moveX !== 0 || moveY !== 0);

  if (isPlayerMoving) {
    myPlayer.x = Math.max(50, Math.min(950, myPlayer.x + moveX));
    myPlayer.y = Math.max(50, Math.min(950, myPlayer.y + moveY));
    multiplayer.sendMyPosition(myPlayer.x, myPlayer.y);

    // 발걸음 사운드 (일정 간격)
    footstepCooldown -= dt;
    if (footstepCooldown <= 0) {
      sound.playFootstep();
      footstepCooldown = 280;
    }
  }

  // 2. 근처 가구 & 펌프 인터랙션 감지 및 배너 제어
  updateInteractionBanner();

  // 3. 가장 가까운 미조사 가구 방향 나침반 갱신
  updateCompass();

  // 4. 다른 플레이어 보간
  const otherPlayers = multiplayer.updateAndGetOtherPlayers();

  // 5. 캔버스 렌더링
  renderer.render(myPlayer, otherPlayers, currentInvestigations, isBroadHandleRemoved, isPlayerMoving);

  requestAnimationFrame(gameLoop);
}

// 상호작용 배너 실시간 업데이트
function updateInteractionBanner() {
  let targetHouse: House | null = null;
  let minDist = 48;

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

  if (distToPump < 45 && !isBroadHandleRemoved) {
    bannerText.textContent = "🚨 브로드 펌프 앞입니다! [스페이스바]로 손잡이를 제거하세요!";
    interactionBanner.classList.remove('opacity-0', 'translate-y-4', 'scale-95');
    interactionBanner.classList.add('opacity-100', 'translate-y-0', 'scale-100');
  } else if (currentHouseNear) {
    const isDone = !!currentInvestigations[currentHouseNear.id];
    bannerText.textContent = isDone 
      ? `✅ [${currentHouseNear.address}] 조사가 완료된 가구입니다.` 
      : `🔍 [${currentHouseNear.address}] 문 앞입니다! E 키를 눌러 인터뷰하세요!`;
    interactionBanner.classList.remove('opacity-0', 'translate-y-4', 'scale-95');
    interactionBanner.classList.add('opacity-100', 'translate-y-0', 'scale-100');
  } else {
    interactionBanner.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
    interactionBanner.classList.add('opacity-0', 'translate-y-4', 'scale-95');
  }
}

// 나침반 내비게이션 화살표
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
    compassLabel.textContent = `다음 미조사 가구: ${Math.round(minDist)}m (${closestHouse.address})`;
  } else {
    compassArrow.style.transform = 'rotate(0deg)';
    compassLabel.textContent = '모든 가구 조사 완료! 펌프로 이동하세요!';
  }
}

// 가구 인터뷰 열기
function checkHouseInteraction() {
  if (interviewModal.classList.contains('active')) return;
  if (!currentHouseNear) return;

  sound.playDoorKnock();
  openInterviewModal(currentHouseNear);
}

// 펌프 손잡이 제거
function checkPumpInteraction() {
  const broadPump = gameData.pumps.find(p => p.isSource);
  if (!broadPump || isBroadHandleRemoved) return;

  const dist = Math.hypot(broadPump.x - myPlayer.x, broadPump.y - myPlayer.y);
  if (dist < 48) {
    if (confirm("🚨 [역사적 결단]\n브로드 스트리트 펌프의 손잡이를 분리하여 오염된 물 공급을 중단하시겠습니까?")) {
      multiplayer.removeBroadPumpHandle();
    }
  }
}

// 인터뷰 모달 팝업
function openInterviewModal(house: House) {
  modalAddress.textContent = house.address;
  modalResident.textContent = `주민: ${house.residentName} (${house.primaryPump === 'own_well' ? '자체 우물 사용' : '공용 펌프'})`;
  modalDeaths.textContent = `사망자: ${house.deaths}명`;
  modalDeaths.className = house.deaths > 0 ? 'text-red-700 font-bold' : 'text-green-700 font-bold text-lg';
  modalText.textContent = `"${house.interviewText}"`;

  const isAlready = !!currentInvestigations[house.id];
  modalRecordBtn.textContent = isAlready ? '수첩에 이미 기록된 가구입니다' : '역학 수첩에 기록하고 지도에 점 찍기';
  modalRecordBtn.disabled = isAlready;

  // 이상치(양조장 등) 첫 발견 시 충격 사운드
  if (house.clueType === 'brewery_anomaly' && !isAlready) {
    setTimeout(() => sound.playShockAnomaly(), 200);
  }

  interviewModal.classList.add('active');
}

// 모달 수첩 기록 완료
modalRecordBtn.addEventListener('click', () => {
  if (!currentHouseNear) return;

  sound.playClueRecorded();

  const record: InvestigationRecord = {
    houseId: currentHouseNear.id,
    investigatorName: myPlayer.name,
    team: myPlayer.team,
    deaths: currentHouseNear.deaths,
    primaryPump: currentHouseNear.primaryPump,
    timestamp: Date.now()
  };

  multiplayer.recordInvestigation(record);
  interviewModal.classList.remove('active');
});

modalCloseBtn.addEventListener('click', () => {
  interviewModal.classList.remove('active');
});

// UI 갱신
function updateProgressUI() {
  const count = Object.keys(currentInvestigations).length;
  const total = gameData.houses.length;
  progressText.textContent = `${count} / ${total} 가구`;

  // 8가구 이상 조사 시 가설 전환 유도
  if (count >= 8 && currentHypothesis === 'miasma') {
    hypoBtn.classList.add('pulse-anim');
  }
}

// 가설 전환 버튼
hypoBtn.addEventListener('click', () => {
  const next = currentHypothesis === 'miasma' ? 'water' : 'miasma';
  multiplayer.switchHypothesis(next);
});

function updateHypothesisUI() {
  if (currentHypothesis === 'miasma') {
    hypoBtn.textContent = '가설: 나쁜 공기설(Miasma)';
    hypoBtn.className = 'hud-btn bg-stone-900/90 text-amber-200 border-amber-800';
    renderer.showMiasmaFog = true;
  } else {
    hypoBtn.textContent = '가설: 오염된 물(수계 전염설)!';
    hypoBtn.className = 'hud-btn bg-blue-900/90 text-blue-200 border-blue-400 font-bold';
    renderer.showMiasmaFog = false;
  }
}

// 안개 토글
fogBtn.addEventListener('click', () => {
  renderer.showMiasmaFog = !renderer.showMiasmaFog;
  fogBtn.textContent = renderer.showMiasmaFog ? '안개: 켜짐' : '안개: 꺼짐';
});

// 전체 맵 토글
let isFullMapView = false;
mapToggleBtn.addEventListener('click', toggleFullMap);
function toggleFullMap() {
  isFullMapView = !isFullMapView;
  if (isFullMapView) {
    renderer.targetZoom = 0.85;
    mapToggleBtn.textContent = '맵 확대 (M)';
  } else {
    renderer.targetZoom = 1.6;
    mapToggleBtn.textContent = '🗺️ 전체 지도 (M)';
  }
}

// 승리 연출
function triggerVictory() {
  sound.playVictoryFanfare();
  confetti({
    particleCount: 160,
    spread: 90,
    origin: { y: 0.55 }
  });
  endingModal.classList.add('active');
}

endingCloseBtn.addEventListener('click', () => {
  endingModal.classList.remove('active');
});
