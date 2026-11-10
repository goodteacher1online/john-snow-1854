import './style.css';
import rawData from './data/snowData.json';
import { SnowGameData, PlayerState, House, InvestigationRecord } from './types.ts';
import { SohoMapRenderer } from './game/renderer.ts';
import { MultiplayerManager } from './game/multiplayer.ts';
import { sound } from './game/audio.ts';
import { navigator } from './game/navigation.ts';
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

const interviewModal = document.getElementById('interview-modal') as HTMLDivElement;
const modalAddress = document.getElementById('modal-address') as HTMLHeadingElement;
const modalResident = document.getElementById('modal-resident') as HTMLParagraphElement;
const modalDeaths = document.getElementById('modal-deaths') as HTMLSpanElement;
const modalText = document.getElementById('modal-text') as HTMLParagraphElement;
const modalRecordBtn = document.getElementById('modal-record-btn') as HTMLButtonElement;
const modalCloseBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;

const endingModal = document.getElementById('ending-modal') as HTMLDivElement;
const endingCloseBtn = document.getElementById('ending-close-btn') as HTMLButtonElement;

// 역학 수첩 모달
const notebookBtn = document.getElementById('notebook-btn') as HTMLButtonElement;
const notebookModal = document.getElementById('notebook-modal') as HTMLDivElement;
const notebookCloseBtn = document.getElementById('notebook-close-btn') as HTMLButtonElement;
const nbHouseCount = document.getElementById('nb-house-count') as HTMLElement;
const nbDeathCount = document.getElementById('nb-death-count') as HTMLElement;
const nbCurrentHypo = document.getElementById('nb-current-hypo') as HTMLElement;
const nbPumpStats = document.getElementById('nb-pump-stats') as HTMLElement;
const nbAnomalies = document.getElementById('nb-anomalies') as HTMLElement;
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
  x: 480,
  y: 520,
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
  if (e.key === 'n' || e.key === 'N') {
    toggleNotebook();
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

  // 2200 월드 대응 시작 위치 (팀별 소호 거리 요충지)
  const TEAM_SPAWNS: Record<string, [number, number]> = {
    team1: [960, 960],   // 폴란드 가 입구 (소호 중심부 인접 길목)
    team2: [1000, 700],  // 북쪽 그레이트 말버러 가
    team3: [720, 1200],  // 서쪽 딘 가
    team4: [1400, 950],  // 동쪽 워윅 가
    team5: [1100, 1450]  // 남쪽 골든 스퀘어 거리
  };
  const [sx, sy] = TEAM_SPAWNS[team] || [960, 960];
  myPlayer.x = sx;
  myPlayer.y = sy;
  renderer.cameraX = sx;
  renderer.cameraY = sy;

  lobbyEl.classList.add('hidden');
  gameContainerEl.classList.remove('hidden');

  // 멀티플레이어 연결
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

  const speed = 0.35 * dt;
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
    // 1854년 소호 도로망 기반 충돌 및 벽 미끄러짐(Wall Sliding) 이동 판정
    const [resolvedX, resolvedY] = navigator.resolveMove(myPlayer.x, myPlayer.y, moveX, moveY);
    
    // 실제로 이동이 일어난 경우에만 위치 업데이트
    if (resolvedX !== myPlayer.x || resolvedY !== myPlayer.y) {
      myPlayer.x = resolvedX;
      myPlayer.y = resolvedY;
      multiplayer.sendMyPosition(myPlayer.x, myPlayer.y);

      footstepCooldown -= dt;
      if (footstepCooldown <= 0) {
        sound.playFootstep();
        footstepCooldown = 260;
      }
    }
  }

  updateInteractionBanner();
  updateCompass();

  const otherPlayers = multiplayer.updateAndGetOtherPlayers();
  renderer.render(myPlayer, otherPlayers, currentInvestigations, isBroadHandleRemoved, isPlayerMoving);

  requestAnimationFrame(gameLoop);
}

// 상호작용 배너
function updateInteractionBanner() {
  let targetHouse: House | null = null;
  let minDist = 72;

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
      : `🔍 [${currentHouseNear.address}] 문 앞입니다! [E] 키를 눌러 인터뷰하세요!`;
    interactionBanner.classList.remove('opacity-0', 'translate-y-6', 'scale-95');
    interactionBanner.classList.add('opacity-100', 'translate-y-0', 'scale-100');
  } else {
    interactionBanner.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
    interactionBanner.classList.add('opacity-0', 'translate-y-6', 'scale-95');
  }
}

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
  if (interviewModal.classList.contains('active')) return;
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

// 인터뷰 모달 열기
function openInterviewModal(house: House) {
  modalAddress.textContent = house.address;
  modalResident.textContent = `주민: ${house.residentName} (${house.primaryPump === 'own_well' ? '자체 우물 사용' : '공용 펌프'})`;
  modalDeaths.textContent = `사망자: ${house.deaths}명`;
  modalDeaths.className = house.deaths > 0 ? 'text-red-700 font-black text-2xl' : 'text-green-700 font-black text-2xl';
  modalText.textContent = `"${house.interviewText}"`;

  const isAlready = !!currentInvestigations[house.id];
  modalRecordBtn.textContent = isAlready ? '수첩에 이미 기록된 가구입니다' : '역학 수첩에 기록하고 지도에 점 찍기 (+50 EXP)';
  modalRecordBtn.disabled = isAlready;

  // 이상치(양조장 등) 첫 발견 시 충격 사운드 및 알림
  if (house.clueType === 'brewery_anomaly' && !isAlready) {
    setTimeout(() => {
      sound.playShockAnomaly();
      showToast('⚠️ 결정적 모순 발견! 공기 때문이라면서 왜 맥주 공장은 0명일까?!', '💥', true);
    }, 200);
  }

  interviewModal.classList.add('active');
}

// 수첩 기록 완료
modalRecordBtn.addEventListener('click', () => {
  if (!currentHouseNear) return;

  sound.playClueRecorded();
  renderer.targetZoom = 1.6; // 줌 복귀

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
  interviewModal.classList.remove('active');

  // ★ [데이터 기반 넛지] 정답을 가르쳐주지 않고 스스로 의문을 품게 만드는 질문 넛지!
  if (currentHouseNear.id === 'house_15') {
    setTimeout(() => {
      showToast('💡 [역학적 의문 #1] 양조장 인부 70명은 종일 소호 공기를 마시는데 사망자 0명! (맥주/자체 우물 음용)', '💡');
    }, 400);
  } else if (currentHouseNear.id === 'house_16') {
    setTimeout(() => {
      showToast('💡 [역학적 의문 #2] 악취가 가장 심한 구빈원(500명)은 사망자 5명뿐! 악취(공기)가 원인일까요?', '💡');
    }, 400);
  } else if (currentHouseNear.id === 'house_17') {
    setTimeout(() => {
      showToast('💡 [역학적 의문 #3] 공기 맑은 시골 전원주택의 마님이 소호 브로드 가 물을 배달받아 마신 후 사망했습니다!', '💡');
    }, 400);
  } else {
    showToast(`[${currentHouseNear.address}] 수첩 기록 완료! (+50 EXP)`);
  }

  updateNotebookUI();
});

modalCloseBtn.addEventListener('click', () => {
  renderer.targetZoom = 1.6;
  interviewModal.classList.remove('active');
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

// 수첩 내부 통계 데이터 실시간 계산 & 시각화
function updateNotebookUI() {
  const investigatedList = Object.values(currentInvestigations);
  const count = investigatedList.length;
  const totalDeaths = investigatedList.reduce((acc, cur) => acc + cur.deaths, 0);

  nbHouseCount.textContent = `${count} / ${gameData.houses.length}`;
  nbDeathCount.textContent = `${totalDeaths} 명`;
  nbCurrentHypo.textContent = currentHypothesis === 'miasma' ? '나쁜 공기설(Miasma)' : '오염된 식수원(Water-borne)';
  nbCurrentHypo.className = currentHypothesis === 'miasma' 
    ? 'text-xs sm:text-sm text-stone-800 block mt-1 font-sans' 
    : 'text-xs sm:text-sm text-blue-700 font-black block mt-1 font-sans';

  // 식수 공급원별 집계
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
    <div class="space-y-3 font-sans">
      <!-- 브로드 가 펌프 이용 가구 -->
      <div>
        <div class="flex justify-between text-xs font-bold text-stone-800 mb-1">
          <span class="text-red-700">🚨 브로드 가 공공 펌프 이용 가구 (${broadHouses}가구)</span>
          <span class="text-red-700 font-black">${broadDeaths}명 사망</span>
        </div>
        <div class="w-full bg-stone-200 h-4 rounded-full overflow-hidden">
          <div class="bg-red-600 h-full rounded-full transition-all duration-500" style="width: ${(broadDeaths / maxDeaths) * 100}%"></div>
        </div>
      </div>

      <!-- 타 공공 펌프 이용 가구 -->
      <div>
        <div class="flex justify-between text-xs font-bold text-stone-800 mb-1">
          <span>💧 타 공공 펌프 이용 가구 (${otherPumpHouses}가구)</span>
          <span class="font-black text-stone-700">${otherPumpDeaths}명 사망</span>
        </div>
        <div class="w-full bg-stone-200 h-3 rounded-full overflow-hidden">
          <div class="bg-blue-600 h-full rounded-full transition-all duration-500" style="width: ${(otherPumpDeaths / maxDeaths) * 100}%"></div>
        </div>
      </div>

      <!-- 자체 우물 / 맥주 음용 (양조장, 구빈원) -->
      <div>
        <div class="flex justify-between text-xs font-bold text-stone-800 mb-1">
          <span class="text-green-700">🛡️ 자체 우물 / 맥주 음용 (양조장·구빈원, ${ownWellHouses}곳)</span>
          <span class="text-green-700 font-black">${ownWellDeaths}명 사망</span>
        </div>
        <div class="w-full bg-stone-200 h-3 rounded-full overflow-hidden">
          <div class="bg-green-600 h-full rounded-full transition-all duration-500" style="width: ${(ownWellDeaths / maxDeaths) * 100}%"></div>
        </div>
      </div>
    </div>
  `;

  // 발견된 모순점 체크리스트
  const anomalies: string[] = [];
  if (currentInvestigations['house_15']) {
    anomalies.push('✅ [양조장 증언] 인부 70명 전원 무사: 종일 소호 공기를 마시지만 공짜 맥주와 자체 우물물만 마심.');
  }
  if (currentInvestigations['house_16']) {
    anomalies.push('✅ [구빈원 증언] 악취가 가장 심한 500명 수용시설의 사망자는 5명뿐: 성문 밖 펌프를 안 쓰고 자체 우물물 음용.');
  }
  if (currentInvestigations['house_17']) {
    anomalies.push('✅ [햄스테드 증언] 소호에서 멀리 떨어진 맑은 시골 저택 마님의 사망: 소호 아들이 브로드 가 물을 마차로 배달.');
  }

  if (anomalies.length > 0) {
    nbAnomalies.innerHTML = anomalies.map(a => `<li class="font-bold text-stone-900">${a}</li>`).join('');
  } else {
    nbAnomalies.innerHTML = `<li class="italic text-stone-500">아직 결정적 모순이 발견되지 않았습니다. 거리의 다양한 장소(양조장, 구빈원, 외곽 저택 등)를 조사해보십시오.</li>`;
  }

  // 가설 전환 버튼 활성화 조건 (모순 1개 이상 또는 가구 5개 이상 조사 시)
  if (count >= 5 || anomalies.length >= 1) {
    switchWaterHypoBtn.disabled = false;
    switchWaterHypoBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  } else {
    switchWaterHypoBtn.disabled = true;
    switchWaterHypoBtn.classList.add('opacity-50', 'cursor-not-allowed');
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

// UI 갱신
function updateProgressUI() {
  const count = Object.keys(currentInvestigations).length;
  const total = gameData.houses.length;
  progressText.textContent = `${count} / ${total} 가구`;

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
    hypoBtn.textContent = '가설: 나쁜 공기설(Miasma)';
    hypoBtn.className = 'hud-btn bg-stone-900/90 text-amber-200 border-amber-800 text-xs sm:text-sm';
    renderer.showMiasmaFog = true;
  } else {
    hypoBtn.textContent = '가설: 오염된 물(수계 전염설)!';
    hypoBtn.className = 'hud-btn bg-blue-900/90 text-blue-200 border-blue-400 font-black text-xs sm:text-sm';
    renderer.showMiasmaFog = false;
  }
}

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
    particleCount: 180,
    spread: 100,
    origin: { y: 0.55 }
  });
  endingModal.classList.add('active');
}

endingCloseBtn.addEventListener('click', () => {
  endingModal.classList.remove('active');
});
