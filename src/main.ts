import './style.css';
import rawData from './data/snowData.json';
import { SnowGameData, PlayerState, House, InvestigationRecord } from './types.ts';
import { SohoMapRenderer } from './game/renderer.ts';
import { MultiplayerManager } from './game/multiplayer.ts';
import confetti from 'canvas-confetti';

const gameData = rawData as SnowGameData;

// DOM 엘리먼트 참조
const lobbyEl = document.getElementById('lobby') as HTMLDivElement;
const gameContainerEl = document.getElementById('game-container') as HTMLDivElement;
const canvasEl = document.getElementById('map-canvas') as HTMLCanvasElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const playerNameInput = document.getElementById('player-name') as HTMLInputElement;
const teamSelect = document.getElementById('team-select') as HTMLSelectElement;
const roomInput = document.getElementById('room-id') as HTMLInputElement;

// HUD 엘리먼트
const progressText = document.getElementById('progress-text') as HTMLSpanElement;
const hypoBtn = document.getElementById('hypo-toggle-btn') as HTMLButtonElement;
const fogBtn = document.getElementById('fog-toggle-btn') as HTMLButtonElement;
const mapToggleBtn = document.getElementById('map-toggle-btn') as HTMLButtonElement;

// 모달 엘리먼트
const interviewModal = document.getElementById('interview-modal') as HTMLDivElement;
const modalAddress = document.getElementById('modal-address') as HTMLHeadingElement;
const modalResident = document.getElementById('modal-resident') as HTMLParagraphElement;
const modalDeaths = document.getElementById('modal-deaths') as HTMLSpanElement;
const modalText = document.getElementById('modal-text') as HTMLParagraphElement;
const modalRecordBtn = document.getElementById('modal-record-btn') as HTMLButtonElement;
const modalCloseBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;

// 엔딩 모달
const endingModal = document.getElementById('ending-modal') as HTMLDivElement;
const endingCloseBtn = document.getElementById('ending-close-btn') as HTMLButtonElement;

// 게임 상태
let currentHouseNear: House | null = null;
let currentInvestigations: Record<string, InvestigationRecord> = {};
let isBroadHandleRemoved = false;
let currentHypothesis: 'miasma' | 'water' = 'miasma';

// 내 플레이어 상태 (초기 위치: 브로드 스트리트 부근 480, 520)
const myPlayer: PlayerState = {
  id: 'me',
  name: '조사관',
  color: '#2563eb',
  team: 'team1',
  x: 480,
  y: 520,
  lastActive: Date.now()
};

// 렌더러 & 멀티플레이어 매니저
const renderer = new SohoMapRenderer(canvasEl, gameData);
const multiplayer = new MultiplayerManager();

// 키보드 입력 상태
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

// 가상 D-Pad (모바일/태블릿)
const dpadButtons = document.querySelectorAll<HTMLButtonElement>('.dpad-btn');
dpadButtons.forEach(btn => {
  const dir = btn.dataset.dir;
  if (!dir) return;
  const startMove = () => { keys[dir] = true; };
  const stopMove = () => { keys[dir] = false; };
  btn.addEventListener('touchstart', startMove);
  btn.addEventListener('touchend', stopMove);
  btn.addEventListener('mousedown', startMove);
  btn.addEventListener('mouseup', stopMove);
});

// 로비 시작 버튼 클릭
startBtn.addEventListener('click', async () => {
  const name = playerNameInput.value.trim() || '영국 조사관';
  const team = teamSelect.value;
  const roomId = roomInput.value.trim() || 'class1';

  myPlayer.name = name;
  myPlayer.team = team;

  // 팀별 시작 위치 분산 (소호의 다른 구역에서 시작)
  const TEAM_SPAWNS: Record<string, [number, number]> = {
    team1: [480, 520], // 브로드 가 중심
    team2: [530, 420], // 케임브리지 가
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

  // 멀티플레이어 이벤트 리스너 등록
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

  // 게임 루프 시작
  requestAnimationFrame(gameLoop);
});

// 게임 루프
let lastLoopTime = performance.now();
function gameLoop(now: number) {
  const dt = Math.min(50, now - lastLoopTime);
  lastLoopTime = now;

  // 1. 플레이어 이동
  const speed = 0.18 * dt; // 이동 속도
  let moveX = 0;
  let moveY = 0;

  if (keys['w'] || keys['arrowup']) moveY -= speed;
  if (keys['s'] || keys['arrowdown']) moveY += speed;
  if (keys['a'] || keys['arrowleft']) moveX -= speed;
  if (keys['d'] || keys['arrowright']) moveX += speed;

  // 대각선 이동 정규화
  if (moveX !== 0 && moveY !== 0) {
    moveX *= 0.7071;
    moveY *= 0.7071;
  }

  if (moveX !== 0 || moveY !== 0) {
    myPlayer.x = Math.max(50, Math.min(950, myPlayer.x + moveX));
    myPlayer.y = Math.max(50, Math.min(950, myPlayer.y + moveY));
    multiplayer.sendMyPosition(myPlayer.x, myPlayer.y);
  }

  // 2. 다른 플레이어 상태 가져오기
  const otherPlayers = multiplayer.updateAndGetOtherPlayers();

  // 3. 캔버스 렌더링
  renderer.render(myPlayer, otherPlayers, currentInvestigations, isBroadHandleRemoved);

  requestAnimationFrame(gameLoop);
}

// 가구 상호작용 체크
function checkHouseInteraction() {
  if (interviewModal.classList.contains('active')) return;

  for (const house of gameData.houses) {
    const dist = Math.hypot(house.x - myPlayer.x, house.y - myPlayer.y);
    if (dist < 40) {
      openInterviewModal(house);
      return;
    }
  }
}

// 펌프 손잡이 제거 인터랙션
function checkPumpInteraction() {
  const broadPump = gameData.pumps.find(p => p.isSource);
  if (!broadPump || isBroadHandleRemoved) return;

  const dist = Math.hypot(broadPump.x - myPlayer.x, broadPump.y - myPlayer.y);
  if (dist < 45) {
    if (confirm("🚨 [역사적 결단]\n브로드 스트리트 펌프의 손잡이를 분리하여 물 공급을 중단하시겠습니까?")) {
      multiplayer.removeBroadPumpHandle();
    }
  }
}

// 인터뷰 모달 열기
function openInterviewModal(house: House) {
  currentHouseNear = house;
  modalAddress.textContent = house.address;
  modalResident.textContent = `주민: ${house.residentName} (${house.primaryPump === 'own_well' ? '자체 우물 사용' : '공용 펌프'})`;
  modalDeaths.textContent = `사망자: ${house.deaths}명`;
  modalDeaths.className = house.deaths > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
  modalText.textContent = `"${house.interviewText}"`;

  const isAlready = !!currentInvestigations[house.id];
  modalRecordBtn.textContent = isAlready ? '수첩에 이미 기록됨' : '역학 수첩에 기록하고 지도에 점 찍기';
  modalRecordBtn.disabled = isAlready;

  interviewModal.classList.add('active');
}

// 모달 수첩 기록 버튼 클릭
modalRecordBtn.addEventListener('click', () => {
  if (!currentHouseNear) return;

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

// UI 업데이트
function updateProgressUI() {
  const count = Object.keys(currentInvestigations).length;
  const total = gameData.houses.length;
  progressText.textContent = `${count} / ${total} 가구`;

  // 10가구 이상 조사 시 가설 전환 유도 배지
  if (count >= 8 && currentHypothesis === 'miasma') {
    hypoBtn.classList.add('pulse-anim');
  }
}

// 가설 변경 버튼
hypoBtn.addEventListener('click', () => {
  const next = currentHypothesis === 'miasma' ? 'water' : 'miasma';
  multiplayer.switchHypothesis(next);
});

function updateHypothesisUI() {
  if (currentHypothesis === 'miasma') {
    hypoBtn.textContent = '현재 가설: 나쁜 공기설(Miasma)';
    hypoBtn.className = 'hud-btn bg-amber-900/80 text-amber-200 border-amber-600';
    renderer.showMiasmaFog = true;
  } else {
    hypoBtn.textContent = '현재 가설: 오염된 물(수계 전염설)!';
    hypoBtn.className = 'hud-btn bg-blue-900/80 text-blue-200 border-blue-500 font-bold';
    renderer.showMiasmaFog = false;
  }
}

// 안개 토글 버튼
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
    renderer.targetZoom = 0.8;
    mapToggleBtn.textContent = '맵 확대 (M)';
  } else {
    renderer.targetZoom = 1.6;
    mapToggleBtn.textContent = '전체 지도 (M)';
  }
}

// 엔딩 및 승리 팡파르
function triggerVictory() {
  confetti({
    particleCount: 150,
    spread: 80,
    origin: { y: 0.6 }
  });
  endingModal.classList.add('active');
}

endingCloseBtn.addEventListener('click', () => {
  endingModal.classList.remove('active');
});
