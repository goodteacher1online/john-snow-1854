// 처음부터 끝까지 실제 화면을 조작해 한 판을 돌려 보는 점검 스크립트.
//   npm run dev  (다른 터미널)
//   node tools/playtest.mjs [스크린샷 폴더]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.GAME_URL || 'http://localhost:5173/';
const OUT = process.argv[2] || 'tools/shots';
mkdirSync(OUT, { recursive: true });

// 창 여러 개를 띄우므로 가려진 창의 화면 갱신이 멈추지 않게 한다
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'],
});
const errors = [];

async function newPlayer(name, room, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
  await page.goto(URL);
  await page.fill('#in-name', name);
  await page.fill('#in-room', room);
  return page;
}
const state = page => page.evaluate(() => window.__game.state());
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const visible = (page, sel) => page.locator(sel).isVisible();

/** 쪽지가 떠 있으면 읽고 닫는다 */
async function dismissNote(page) {
  await page.waitForTimeout(1700);
  if (await visible(page, '#note.open')) { await page.click('#note-ok'); await page.waitForTimeout(300); }
}

/** 면담 장면을 끝까지 진행한다 */
async function playInterview(page) {
  await page.waitForSelector('#scene:not(.hidden)');
  for (let guard = 0; guard < 80 && await visible(page, '#scene'); guard++) {
    const opt = page.locator('#scene-choices .opt:not(.done):not(.leave)').first();
    if (await opt.count()) await opt.click();
    else await page.keyboard.press('Space');
    await page.waitForTimeout(60);
  }
}

async function visit(page, id) {
  const [x, y] = await page.evaluate(i => window.__game.door(i), id);
  await page.evaluate(([x, y]) => window.__game.teleport(x, y), [x, y]);
  await page.bringToFront();
  await page.waitForTimeout(350);
  if (process.env.DEBUG) console.log(id, JSON.stringify(await page.evaluate(() => { const s = window.__game.state(); return { near: s.near, x: s.x, y: s.y, modal: !!document.querySelector('.modal.open'), scene: !document.getElementById('scene').classList.contains('hidden') }; })));
  await page.keyboard.press('e');
  await playInterview(page);
}

const room = String(Math.floor(1000 + Math.random() * 9000));
const p1 = await newPlayer('지우', room);
await shot(p1, '01_lobby');
await p1.click('#btn-start');
await p1.waitForSelector('#note.open');
await shot(p1, '02_first_note');
await p1.click('#note-ok');
await p1.waitForTimeout(1200);
await shot(p1, '03_street');

// 1) 건물을 눌러 걸어가기: 길 찾기와 자동 면담
const [ix, iy] = await p1.evaluate(() => window.__game.iconOnScreen('lodging'));
await p1.mouse.click(ix, iy);
await p1.waitForTimeout(500);
await shot(p1, '04_walking');
await p1.waitForSelector('#scene:not(.hidden)', { timeout: 20000 });
await p1.waitForTimeout(900);
await shot(p1, '05_interview_intro');
for (let i = 0; i < 6 && !(await p1.locator('#scene-choices .opt').count()); i++) { await p1.keyboard.press('Space'); await p1.waitForTimeout(80); }
await shot(p1, '06_interview_choices');
await playInterview(p1);
await p1.waitForTimeout(600);
await shot(p1, '07_recorded');

// 2) 키보드 걷기: 벽에 막히지 않고 미끄러지는지
const before = await state(p1);
await p1.keyboard.down('ArrowRight'); await p1.waitForTimeout(1500); await p1.keyboard.up('ArrowRight');
const after = await state(p1);
console.log('키보드 이동 거리', Math.round(Math.hypot(after.x - before.x, after.y - before.y)));

// 3) 두 번째 조사관이 같은 방에 들어온다
const p2 = await newPlayer('민서', room);
await p2.click('#in-team .pick[data-value="team3"]');
await p2.click('#btn-start');
await p2.waitForSelector('#note.open');
await p2.click('#note-ok');

await visit(p1, 'lewis');
await visit(p1, 'cambridge');
await dismissNote(p1);                       // 공기설 시험
console.log('1단계 뒤', (await state(p1)).stage);
await visit(p1, 'workhouse');
await p1.waitForTimeout(400);
await shot(p1, '08_key_clue');
await visit(p1, 'brewery');
await dismissNote(p1);                       // 추리 → 수첩이 열린다
await p1.waitForSelector('#notebook.open');
await shot(p1, '09_reason');
await p1.click('#notebook .tab[data-tab="compare"]');
await p1.waitForTimeout(800);
await shot(p1, '10_compare_smell');
await p1.click('.seg button[data-by="water"]');
await p1.waitForTimeout(800);
await shot(p1, '11_compare_water');
await p1.click('#notebook .tab[data-tab="reason"]');
await p1.click('.reason-opts .opt >> nth=0');     // 일부러 틀린다
await p1.waitForTimeout(300);
await shot(p1, '12_reason_wrong');
await p1.click('.reason-opts .opt >> nth=1');
await p1.click('.reason-opts .opt >> nth=2');
await dismissNote(p1);                       // 가설 확인
console.log('추리 뒤', (await state(p1)).stage);
await visit(p1, 'gould');
await visit(p1, 'eley');
await visit(p1, 'carnaby');
await dismissNote(p1);                       // 위원회 → 수첩
await p1.waitForSelector('#go-hearing');
await p1.click('#notebook .tab[data-tab="records"]');
await p1.waitForTimeout(300);
await shot(p1, '13_records');
await p1.click('#notebook .tab[data-tab="reason"]');
await p1.click('#go-hearing');

// 위원회: 반박마다 기록 한 장
const pick = async label => {
  for (let i = 0; i < 12 && !(await p1.locator('#scene-choices .opt').count()); i++) { await p1.keyboard.press('Space'); await p1.waitForTimeout(80); }
  await p1.locator('#scene-choices .opt', { hasText: label }).first().click();
};
await pick('브로드 가 40번지');              // 틀린 증거
await p1.waitForTimeout(700);
await shot(p1, '14_hearing_rebuff');
await pick('폴란드 가 구빈원');
await pick('라이온 양조장');
for (let i = 0; i < 12 && !(await p1.locator('#scene-choices .opt').count()); i++) { await p1.keyboard.press('Space'); await p1.waitForTimeout(80); }
await shot(p1, '15_hearing_choices');
await pick('일리 형제 뇌관 공장');
for (let i = 0; i < 20 && await visible(p1, '#scene'); i++) { await p1.keyboard.press('Space'); await p1.waitForTimeout(80); }
await dismissNote(p1);                       // 손잡이
console.log('위원회 뒤', (await state(p1)).stage);

await p1.keyboard.press('m');
await p1.waitForTimeout(1600);
await shot(p1, '16_overview');
await p1.keyboard.press('b');
await p1.waitForTimeout(1200);
await shot(p1, '17_board');
console.log('함께 있는 조사관', (await state(p1)).others, '/', (await state(p2)).others);
await p1.keyboard.press('Escape');

const [px, py] = await p1.evaluate(() => window.__game.pump());
await p1.evaluate(([x, y]) => window.__game.teleport(x, y), [px, py]);
await p1.waitForTimeout(400);
await shot(p1, '18_at_pump');
await p1.keyboard.press('e');
await p1.waitForSelector('#ending.open', { timeout: 8000 });
await shot(p1, '19_ending_1');
for (let i = 0; i < 3; i++) await p1.click('#ending-actions .btn.primary');
await p1.waitForTimeout(300);
await shot(p1, '20_ending_report');
await p1.click('#ending-actions .btn.primary');
await p1.waitForTimeout(800);
await shot(p1, '21_after');
const end = await state(p1);
console.log('끝', { stage: end.stage, records: end.records.length, xp: end.xp, misses: end.misses });

await p2.waitForTimeout(600);
await shot(p2, '22_classmate_view');

// 좁은 화면(휴대전화)
const m = await newPlayer('모바일', room + '9', { width: 390, height: 780 });
await shot(m, '23_mobile_lobby');
await m.click('#btn-start');
await m.waitForSelector('#note.open');
await m.click('#note-ok');
await m.waitForTimeout(800);
await visit(m, 'coffee').catch(() => {});
await shot(m, '24_mobile_after');

console.log(errors.length ? '오류:\n' + errors.join('\n') : '콘솔 오류 없음');
await browser.close();
