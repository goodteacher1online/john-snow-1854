import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/goodt/.gemini/antigravity-cli/brain/52c09cb9-751c-4c3a-944b-d14cdd4796a5';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // 1. 로비 화면 캡처 (남성/여성 선택, 낫싱 UI, 이모지 박멸)
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_16_lobby_gender_nothing_ui.png') });
  console.log('Saved: verify_16_lobby_gender_nothing_ui.png');

  // 2. 여성 캐릭터 클릭
  const femaleBtn = page.locator('.gender-btn[data-gender="female"]');
  await femaleBtn.click();
  await page.waitForTimeout(300);

  // 로비에서 여성 캐릭터 선택된 상태 캡처
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_17_female_character_selected.png') });
  console.log('Saved: verify_17_female_character_selected.png');

  // 3. 게임 시작 버튼 클릭
  const startBtn = page.locator('#start-btn');
  await startBtn.click();
  await page.waitForTimeout(1000);

  // 4. 수사 지침서 모달 캡처
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_18_briefing_modal_nothing_ui.png') });
  console.log('Saved: verify_18_briefing_modal_nothing_ui.png');

  // 5. 지침서 확인 클릭 -> 게임 맵 진입
  const confirmBtn = page.locator('#briefing-confirm-btn');
  await confirmBtn.click();
  await page.waitForTimeout(1000);

  // 6. 여성 레고 과학자 아바타 & 고지도 도로망 & 실사 건물 캡처
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_19_female_lego_avatar_and_real_houses.png') });
  console.log('Saved: verify_19_female_lego_avatar_and_real_houses.png');

  // 7. 가구로 이동하여 조사 (E)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(80);
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);

  // 인터뷰 모달이 뜨는지 또는 E키
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(600);

  // 인터뷰 모달 상태 캡처
  const interviewVisible = await page.locator('#interview-modal').evaluate(el => el.classList.contains('active'));
  if (interviewVisible) {
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_20_interview_modal_cleaned.png') });
    console.log('Saved: verify_20_interview_modal_cleaned.png');
    await page.locator('#modal-record-btn').click();
    await page.waitForTimeout(600);
  }

  // 8. 역학 수첩 열기 (N)
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_21_notebook_modal_anti_slop.png') });
  console.log('Saved: verify_21_notebook_modal_anti_slop.png');

  await browser.close();
  console.log('E2E Verification Completed Successfully!');
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
