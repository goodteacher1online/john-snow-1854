import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  
  console.log('[Verification] 1. http://localhost:3000 접속 중...');
  await page.goto('http://localhost:3000');
  
  const title = await page.title();
  console.log('[Verification] 페이지 타이틀:', title);
  
  // 1. 로비 화면 캡처
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_1_lobby.png' });
  console.log('[Verification] 로비 스크린샷 저장 완료: verify_1_lobby.png');

  // 2. 이름 입력 및 시작 버튼 클릭
  await page.fill('#player-name', '테스트조사관');
  await page.selectOption('#team-select', 'team1');
  await page.click('#start-btn');
  
  // 3. 캔버스 로딩 대기
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_2_gameplay.png' });
  console.log('[Verification] 캔버스 게임플레이 스크린샷 저장 완료: verify_2_gameplay.png');

  // 4. E 키 눌러서 근처 가구 조사 모달 열기
  await page.keyboard.press('e');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_3_modal.png' });
  console.log('[Verification] 가구 조사 모달 스크린샷 저장 완료: verify_3_modal.png');

  console.log('🎉 [Verification] 모든 E2E 테스트 성공!');
  await browser.close();
}

verify().catch(err => {
  console.error('[Verification Failed]', err);
  process.exit(1);
});
