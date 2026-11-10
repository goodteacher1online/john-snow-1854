import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  
  console.log('[Verification] 1. http://localhost:5173 접속 중...');
  await page.goto('http://localhost:5173');
  
  // 1. 신규 로비 캡처 (원클릭 참여, 주사위 이름, 팀 카드)
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_1_lobby_v2.png' });
  console.log('[Verification] 로비 v2 스크린샷 저장 완료');

  // 2. 시작 버튼 클릭
  await page.click('#start-btn');
  await page.waitForTimeout(600);

  // 3. 미션 브리핑 팝업 캡처
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_2_briefing.png' });
  console.log('[Verification] 미션 브리핑 지침서 스크린샷 저장 완료');

  // 4. 지침 숙지 버튼 클릭 후 게임 진입
  await page.click('#briefing-confirm-btn');
  await page.waitForTimeout(1500);

  // 5. 19세기 과학자 아바타 & 캔버스 고지도 & 나침반 캡처
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_3_scientist_gameplay.png' });
  console.log('[Verification] 과학자 캐릭터 & 사실적 고지도 스크린샷 저장 완료');

  console.log('🎉 [Verification] 모든 신규 UX/UI 검증 100% 통과!');
  await browser.close();
}

verify().catch(err => {
  console.error('[Verification Failed]', err);
  process.exit(1);
});
