// 한 방에 학생 여러 명이 들어왔을 때를 재현한다. 브라우저 창을 N개 띄워 같은 방 번호로 들어가게 하고,
// 각자 걷고 면담하게 한 뒤 서로의 모습과 기록이 빠짐없이 전해졌는지, 오류와 화면 끊김이 없는지 본다.
//   npm run dev  (다른 터미널)
//   node tools/loadtest.mjs [인원=24] [조사 시간(초)=40]
import { chromium } from 'playwright';

const URL = process.env.GAME_URL || 'http://localhost:5173/';
const N = Number(process.argv[2] || 24);
const SECONDS = Number(process.argv[3] || 40);
const WHOLE = process.argv[4] === 'class';      // 'class' 를 주면 학급 전체가 한 방(20명 한계 확인용), 기본은 모둠별 방
const room = 'T' + Math.floor(10000 + Math.random() * 89999);
const SITES = ['lewis', 'lodging', 'cambridge', 'coffee', 'berwick', 'brewery', 'workhouse', 'gould', 'eley', 'carnaby', 'marlborough', 'pulteney', 'rupert', 'littlepulteney'];
const TEAMS = ['team1', 'team2', 'team3', 'team4', 'team5'];

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'],
});
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function join(i) {
  const name = `학생${String(i + 1).padStart(2, '0')}`;
  const ctx = await browser.newContext({ viewport: { width: 800, height: 520 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${name}] ${e.message} ${(e.stack || '').split(/\n/).slice(0, 4).join(' | ').slice(0, 400)}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text().slice(0, 160)}`); });
  await page.goto(URL);
  await page.fill('#in-name', name);
  await page.click(`#in-team .pick[data-value="${TEAMS[i % 5]}"]`);
  await page.click('#btn-room');
  await page.fill('#in-room', room);
  if (WHOLE) await page.check('#in-all');
  await page.click('#btn-start');
  await page.waitForSelector('#note.open');
  await page.click('#note-ok');
  return { name, page, visited: [], team: i % 5 };
}

/** 쪽지·수첩이 떠 있으면 닫고, 한 곳을 찾아가 면담을 끝낸다 */
async function investigate(bot, id) {
  const { page } = bot;
  for (const sel of ['#note-body .opt', '#note.open #note-ok', '#notebook.open #notebook-close']) {
    const b = page.locator(sel).first();
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
  }
  const [x, y] = await page.evaluate(i => window.__game.door(i), id);
  await page.evaluate(([x, y]) => window.__game.teleport(x, y), [x, y]);
  await sleep(450);
  await page.keyboard.press('e');
  if (!await page.waitForSelector('#scene:not(.hidden)', { timeout: 4000 }).catch(() => null)) return;
  for (let guard = 0; guard < 90 && await page.locator('#scene').isVisible(); guard++) {
    const opt = page.locator('#scene-choices .opt:not(.done):not(.leave)').first();
    if (await opt.count()) await opt.click().catch(() => {}); else await page.keyboard.press('Space');
    await sleep(50);
  }
  bot.visited.push(id);
}

async function wander(bot) {
  const key = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][Math.floor(Math.random() * 4)];
  await bot.page.keyboard.down(key);
  await sleep(700 + Math.random() * 900);
  await bot.page.keyboard.up(key);
}

console.log(`방 ${room} 에 ${N}명 입장 중...`);
const t0 = Date.now();
const bots = [];
for (let i = 0; i < N; i += 6) bots.push(...await Promise.all(Array.from({ length: Math.min(6, N - i) }, (_, k) => join(i + k))));
console.log(`입장 완료 ${((Date.now() - t0) / 1000).toFixed(1)}초`);

// 모두가 동시에 걷고 조사한다
const until = Date.now() + SECONDS * 1000;
await Promise.all(bots.map(async (bot, i) => {
  const order = [...SITES].sort(() => Math.random() - 0.5);
  while (Date.now() < until) {
    if (order.length && Math.random() < 0.6) await investigate(bot, order.pop()).catch(e => errors.push(`[${bot.name}] 조작 실패: ${e.message.slice(0, 120)}`));
    else await wander(bot).catch(() => {});
  }
}));
await sleep(3000);          // 마지막 기록이 퍼질 시간

// 결과: 각 창이 본 것
const rows = await Promise.all(bots.map(async bot => {
  const s = await bot.page.evaluate(async () => {
    // 3초 동안 화면이 몇 번 그려지는지 (끊김 확인). 가려진 창은 그리기를 쉬므로, 상태는 그린 뒤에 읽는다
    const fps = await new Promise(res => { let n = 0; const t = performance.now(); const f = () => { n++; performance.now() - t < 3000 ? requestAnimationFrame(f) : res(n / 3); }; requestAnimationFrame(f); });
    const st = window.__game.state();
    return { others: st.others.length, mine: st.records.length, peers: window.__game.peerRecords(), fps: Math.round(fps) };
  });
  return { name: bot.name, team: bot.team, visited: bot.visited.length, ...s };
}));

// 같은 방에 있어야 할 사람들끼리 견준다
const mates = r => rows.filter(o => WHOLE || o.team === r.team);
const expectTotal = rows.reduce((n, r) => n + r.mine, 0);
const missingPeers = rows.filter(r => r.others !== mates(r).length - 1);
const missingRecords = rows.filter(r => r.peers !== mates(r).reduce((n, o) => n + o.mine, 0) - r.mine);
const fpsList = rows.map(r => r.fps).sort((a, b) => a - b);
console.log(`\n인원 ${N}명 (${WHOLE ? '학급 전체 한 방' : '모둠별 방 5개'}) · 조사 ${SECONDS}초 · 전체 기록 ${expectTotal}건`);
console.log(`서로 모두 보임: ${N - missingPeers.length}/${N}` + (missingPeers.length ? `  (안 맞는 창: ${missingPeers.map(r => `${r.name}=${r.others}`).join(', ')})` : ''));
console.log(`친구 기록이 빠짐없이 전해짐: ${N - missingRecords.length}/${N}` + (missingRecords.length ? `  (안 맞는 창: ${missingRecords.slice(0, 8).map(r => `${r.name} ${r.peers}/${mates(r).reduce((n, o) => n + o.mine, 0) - r.mine}`).join(', ')})` : ''));
console.log(`화면 갱신(초당): 최저 ${fpsList[0]} · 중간 ${fpsList[Math.floor(N / 2)]} · 최고 ${fpsList[N - 1]}  (창 ${N}개를 한 PC에서 돌린 값)`);
console.log(errors.length ? `오류 ${errors.length}건:\n` + [...new Set(errors)].slice(0, 12).join('\n') : '콘솔 오류 없음');
await bots[0].page.keyboard.press('b');
await sleep(1500);
await bots[0].page.setViewportSize({ width: 1440, height: 900 });
await sleep(800);
if (process.env.SHOT) await bots[0].page.screenshot({ path: process.env.SHOT });
await browser.close();
