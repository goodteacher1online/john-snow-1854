import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  console.log('[Verification] 1. http://localhost:5173 접속 중...');
  await page.goto('http://localhost:5173');
  
  // 1. 시작 버튼 클릭
  await page.click('#start-btn');
  await page.waitForTimeout(500);

  // 2. 미션 브리핑 확인
  await page.click('#briefing-confirm-btn');
  await page.waitForTimeout(600);

  // 3. 자갈길을 걷는 레고 과학자 캡처
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_7_lego_scientist_and_cobblestone.png' });
  console.log('[Verification] 레고 과학자 & 자갈길 톤 스크린샷 캡처 완료');

  // 4. 'N' 키를 눌러 제1막 수첩 열기 (스포일러 차단 상태)
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(600);

  // 5. 스포일러가 완전히 차단된 제1막 역학 일지 캡처!
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_8_spoiler_free_phase1_notebook.png' });
  console.log('[Verification] 스포일러 없는 제1막 역학 일지 캡처 완료');

  console.log('🎉 [Verification] 모든 신규 UX/UI 및 개연성 시나리오 검증 완료!');
  await browser.close();
}

verify().catch(err => {
  console.error('[Verification Failed]', err);
  process.exit(1);
});
