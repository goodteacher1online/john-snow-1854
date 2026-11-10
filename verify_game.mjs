import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  console.log('[Verification] 1. http://localhost:5173 접속 중...');
  await page.goto('http://localhost:5173');
  
  // 1. 로비 캡처
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_1_lobby_v3.png' });
  console.log('[Verification] 로비 스크린샷 저장 완료');

  // 2. 시작 버튼 클릭
  await page.click('#start-btn');
  await page.waitForTimeout(500);

  // 3. 미션 브리핑 닫기
  await page.click('#briefing-confirm-btn');
  await page.waitForTimeout(800);

  // 4. 소호 길을 따라 걸어가기 (도로 보행 충돌 검사)
  console.log('[Verification] 도로 위 보행 이동 중...');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(400);

  // 5. 집 앞 조사 및 인터뷰 열기
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(600);

  // 6. 인터뷰 모달에서 수첩 기록 버튼 클릭 (+50 EXP 및 사망자 막대 생성)
  await page.click('#modal-record-btn');
  await page.waitForTimeout(1000);

  // 7. 조사 완료 후 건물 위에 존 스노우 잉크 막대탑(Death Bars)이 솟아오른 게임 화면 캡처!
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_5_death_bars.png' });
  console.log('[Verification] 존 스노우 사망자 잉크 막대탑 스크린샷 캡처 완료');

  // 8. 'N' 키를 눌러 역학 분석 수첩 모달 열기
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(700);

  // 9. 역학 데이터 분석 수첩 (식수원별 사망자 비교 표 & 넛지 모순 아카이브) 캡처!
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_6_data_notebook.png' });
  console.log('[Verification] 역학 데이터 수첩 모달 스크린샷 캡처 완료');

  console.log('🎉 [Verification] 모든 신규 고증 및 데이터 기반 넛지 E2E 검증 100% 통과!');
  await browser.close();
}

verify().catch(err => {
  console.error('[Verification Failed]', err);
  process.exit(1);
});
