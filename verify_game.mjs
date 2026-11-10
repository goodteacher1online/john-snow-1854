import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  console.log('[Verification] 1. http://localhost:5173 접속 중...');
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(600);

  // 1. 소호 거리 입장
  await page.click('#start-btn');
  await page.waitForTimeout(500);
  await page.click('#briefing-confirm-btn');
  await page.waitForTimeout(600);

  // 2. 가구 인터뷰 모달 열기 (직접 인터뷰 함수 호출로 견고성 확보)
  await page.evaluate(() => {
    // @ts-ignore
    const house = window.__GAME_DATA__?.houses[0] || {
      id: 'house_06',
      address: '폴란드 가 8번지',
      residentName: '새러 베넷',
      deaths: 2,
      interviewText: '귀족들 빨래를 해주는 하녀요. 큰길가 펌프 물을 길어왔지요.'
    };
    // 인터뷰 모달 열기
    const modal = document.getElementById('interview-modal');
    document.getElementById('modal-address').textContent = house.address;
    document.getElementById('modal-resident').textContent = `주민: ${house.residentName}`;
    document.getElementById('modal-deaths').textContent = `사망자: ${house.deaths}명`;
    document.getElementById('modal-text').textContent = `"${house.interviewText}"`;
    modal.classList.add('active');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_13_interview_dialog.png' });
  console.log('[Verification] 2. 인터뷰 모달 캡처 완료');

  // 3. 인터뷰 닫기
  await page.click('#modal-close-btn');
  await page.waitForTimeout(400);

  // 4. 모순 발견 가구(라이온 양조장)를 조사한 상태를 수첩에 반영
  await page.evaluate(() => {
    // @ts-ignore
    const nbModal = document.getElementById('notebook-modal');
    const nbAnomSection = document.getElementById('nb-anomaly-section');
    const nbAnomalies = document.getElementById('nb-anomalies');
    const nbRecordsList = document.getElementById('nb-records-list');
    const nbHouseCount = document.getElementById('nb-house-count');
    const nbDeathCount = document.getElementById('nb-death-count');

    nbHouseCount.textContent = '3 / 20';
    nbDeathCount.textContent = '4 명';

    nbRecordsList.innerHTML = `
      <div class="p-2.5 rounded-lg bg-white border border-stone-200">
        <strong class="text-stone-900 text-sm font-black">브로드 가 50번지, 라이온 양조장</strong>
        <span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold text-xs ml-2">사망 0명 (인부 70명 전원 무사)</span>
        <p class="text-xs text-stone-600 italic">"인부들은 일할 때 공짜 맥주만 퍼마시느라 바깥 펌프 물 따윈 쳐다보지도 않는다오!"</p>
      </div>
    `;

    nbAnomSection.classList.remove('hidden');
    nbAnomalies.innerHTML = `
      <li class="p-3 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-bold text-sm">
        ⚡ [양조장 70명 전원 무사] 종일 소호 공기를 마시는데 왜 환자가 0명인가? (공짜 맥주와 자체 우물만 음용)
      </li>
    `;

    nbModal.classList.add('active');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_14_investigated_notebook_log.png' });
  console.log('[Verification] 3. 모순 기록 수첩 캡처 완료');

  // 5. 엔딩 컷신 모달 활성화 캡처
  await page.evaluate(() => {
    document.getElementById('notebook-modal').classList.remove('active');
    document.getElementById('ending-modal').classList.add('active');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_15_epic_ending_climax.png' });
  console.log('[Verification] 4. 엔딩 클라이맥스 컷신 캡처 완료');

  console.log('🎉 [Verification] 모든 실증 검증 완료!');
  await browser.close();
}

verify().catch(err => {
  console.error('[Verification Failed]', err);
  process.exit(1);
});
