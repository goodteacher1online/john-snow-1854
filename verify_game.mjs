import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
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
  await page.waitForTimeout(800);

  // 5. 북쪽의 브로드 가 40번지(house_01)로 걸어가기 (W 키 누르기)
  console.log('[Verification] 브로드 가 40번지(house_01)로 걸어가는 중...');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(500);

  // 6. 집 앞 [E] 프롬프트 캡처
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_3_prompt_e.png' });
  console.log('[Verification] 집 앞 [E] 상호작용 프롬프트 캡처 완료');

  // 7. E 키 눌러 가구 조사 팝업 오픈
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(800);

  // 8. 주민 인터뷰 팝업 캡처
  await page.screenshot({ path: 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5/verify_4_interview.png' });
  console.log('[Verification] 가구 인터뷰 팝업 스크린샷 저장 완료');

  console.log('🎉 [Verification] 모든 E2E 게임플레이 검증 완료!');
  await browser.close();
}

verify().catch(err => {
  console.error('[Verification Failed]', err);
  process.exit(1);
});
