/// <reference types="vite/client" />
import './style.css';
import { Avatar, PortraitId, QuestionId, RemotePlayer, SaveData, Site } from './types.ts';
import {
  SITES, SITE_BY_ID, PUMPS, BROAD_PUMP, STAGE, DATES, NOTES, REASONING, HEARING, EPILOGUE, AREAS, LOOKS, WORLD_SCALE, districtOf, AREA_CAP, RANKS, SOURCES, PRIMER, GLOSSARY,
  questView, stageCleared, hearingRebuff, smellWord, placeName, rankOf, teamColor, areaName,
} from './data/story.ts';
import { Renderer } from './game/renderer.ts';
import { Nav } from './game/nav.ts';
import { Multiplayer } from './game/multiplayer.ts';
import { sound } from './game/audio.ts';
import { Scene, SceneClosed } from './ui/scene.ts';
import { Notebook } from './ui/notebook.ts';
import { esc, factsHtml, QUESTIONS } from './ui/cards.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const SAVE_KEY = 'snow1854.save.v2';
const SPEED = 92;            // 걷는 속도 (월드 단위/초)
const REACH = 40;            // 문·펌프에 손이 닿는 거리
const XP = { record: 40, clue: 30, reason: 100, rebut: 80, handle: 100 };
const portraitUrl = (id: PortraitId) => `./assets/portraits/${id}.webp`;
const QUESTION_LABEL: Record<QuestionId, string> = {
  toll: '누가 앓았는지 묻는다', air: '주변 공기와 냄새를 묻는다', water: '마실 물을 어디서 긷는지 묻는다',
};
const STAGE_LABEL = ['첫 조사', '공기설 시험', '추리', '가설 확인', '위원회', '손잡이', '조사 완료'];

// ---------------------------------------------------------------------------
// 저장
// ---------------------------------------------------------------------------
function freshSave(keep?: Partial<SaveData>): SaveData {
  return {
    name: keep?.name ?? '', look: keep?.look ?? LOOKS[Math.floor(Math.random() * LOOKS.length)], team: keep?.team ?? 'team1', room: keep?.room ?? '',
    stage: 0, records: [], asked: {}, xp: 0, reasonStep: 0, misses: 0, noteSeen: -1, x: 0, y: 0,
  };
}
function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const old = JSON.parse(raw);
      if (!old.look && old.gender) old.look = old.gender === 'male' ? 'm1' : 'f1';
      return { ...freshSave(), ...old };
    }
  } catch { /* 저장소를 못 쓰는 환경이면 새로 시작한다 */ }
  return freshSave();
}
function persist() {
  save.x = me.x; save.y = me.y;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 무시 */ }
}

let save = loadSave();
const me: Avatar = { id: 'me', name: '', team: 'team1', look: 'f1', x: BROAD_PUMP.x, y: BROAD_PUMP.y, facing: 1, moving: false };

const scene = new Scene();
const renderer = new Renderer($<HTMLCanvasElement>('map'));
const nav = new Nav();
const mp = new Multiplayer();
const navReady = nav.load('./assets/walk_mask.png');

const has = (id: string) => save.records.includes(id);
/** 내가 맡은 영역 (혼자일 때는 브로드 가) */
const myArea = () => (save.room ? save.team : 'team1');
const recordedSites = () => save.records.map(id => SITE_BY_ID[id]).filter(Boolean);

let started = false;
let cinematic = false;
let overview = false;
let board = false;
let userZoom = 0;
let path: [number, number][] | null = null;
let onArrive: (() => void) | null = null;
let nearId: string | null = null;
let guide: [number, number][] | null = null;   // 지금 할 일까지 길을 따라가는 안내선
let guideName = '';
let crowdWarned = false;
let noteAt = 0;
let afterNote: (() => void) | null = null;   // 쪽지를 닫은 뒤에 할 일            // 이 시각 이후, 화면이 한가해지면 새 쪽지를 띄운다
let sceneSeenAt = 0;       // 장면이 마지막으로 열려 있던 시각 (닫자마자 또 문을 두드리지 않게)
let others: RemotePlayer[] = [];
const keys = new Set<string>();

// ---------------------------------------------------------------------------
// 알림
// ---------------------------------------------------------------------------
let toastTimer = 0;
function toast(msg: string, sub = '', key = false) {
  const t = $('toast');
  t.innerHTML = esc(msg) + (sub ? `<small>${esc(sub)}</small>` : '');
  t.classList.toggle('key', key);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), key ? 5200 : 3200);
}

function tick(msg: string, color?: string) {
  const row = document.createElement('div');
  row.className = 'tick';
  if (color) row.style.setProperty('--c', color);
  row.innerHTML = `<i></i><span>${esc(msg)}</span>`;
  $('ticker').prepend(row);
  setTimeout(() => { row.classList.add('out'); setTimeout(() => row.remove(), 400); }, 4500);
}

function flash() {
  const f = $('flash');
  f.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
}

const modalOpen = () => !!document.querySelector('.modal.open');
function openModal(id: string) {
  $(id).classList.add('open');
  // 단추에 초점을 주되 글이 긴 종이는 맨 위부터 읽게 한다
  $(id).querySelector<HTMLElement>('.btn.primary')?.focus({ preventScroll: true });
  const sheet = $(id).querySelector<HTMLElement>('.sheet');
  if (sheet) sheet.scrollTop = 0;
}
const closeModal = (id: string) => $(id).classList.remove('open');

// ---------------------------------------------------------------------------
// 화면 위 정보
// ---------------------------------------------------------------------------
function updateHud(bump = false) {
  const quest = questView(save.stage, has, myArea());
  $('hud-date').textContent = DATES[save.stage];
  $('quest-title').textContent = quest.title;
  $('quest-items').innerHTML = quest.items.map(i => `<li class="${i.done ? 'done' : ''}">${esc(i.label)}</li>`).join('');
  if (bump) {
    $('quest').classList.remove('bump');
    void $('quest').offsetWidth;
    $('quest').classList.add('bump');
  }
  const next = RANKS.find(r => r[0] > save.xp);
  const floor = RANKS.filter(r => r[0] <= save.xp).pop()![0];
  $('hud-rank').textContent = rankOf(save.xp);
  $('hud-xp').textContent = `${save.xp}점`;
  $('hud-xp-bar').style.width = next ? `${(save.xp - floor) / (next[0] - floor) * 100}%` : '100%';
  $('hud-count').textContent = `기록 ${save.records.length}/${SITES.length}`;
  $('notebook-dot').classList.toggle('hidden', !notebook.needsReason);
  renderLedger();
}

/** 조사 기록판: 사망 비율이 높은 곳부터 한 줄씩. 줄을 누르면 그 집에서 들은 내용이 펼쳐진다 */
let ledgerOpenRow = '';
let ledgerKey = '';
function renderLedger() {
  // 내 기록에 더해, 같은 방 친구들이 조사한 다른 곳도 함께 싣는다 (누가 조사했는지 이름을 단다)
  const byFriend = new Map<string, string>();
  for (const o of others) for (const id of o.records) if (!has(id) && !byFriend.has(id)) byFriend.set(id, o.name);
  // 다른 영역에서 조사한 곳 (영역 대표들이 반 전체 방에서 주고받은 기록)
  for (const [team, ids] of Object.entries(mp.classAreas)) {
    if (team === save.team) continue;
    for (const id of ids) if (!has(id) && !byFriend.has(id)) byFriend.set(id, `${areaName(team)} 영역`);
  }
  const recs = [...recordedSites(), ...[...byFriend.keys()].map(id => SITE_BY_ID[id]).filter(Boolean)]
    .sort((a, b) => b.deaths / b.people - a.deaths / a.people);
  const last = save.records[save.records.length - 1];
  ledgerKey = `${save.records.length}|${byFriend.size}`;
  $('ledger-count').textContent = byFriend.size ? `${save.records.length} + 친구 ${byFriend.size}` : `${recs.length}/${SITES.length}`;
  $('ledger-body').innerHTML = recs.length ? `
    <table>
      <thead><tr><th>조사한 곳</th><th>사망</th><th>악취</th><th>마시는 물</th></tr></thead>
      <tbody>${recs.map(s => `
        <tr data-id="${s.id}" class="${s.id === last ? 'new' : ''}${s.id === ledgerOpenRow ? ' open' : ''}">
          <td>${esc(s.name)}${byFriend.has(s.id) ? `<small class="by">${esc(byFriend.get(s.id)!)} 조사</small>` : ''}</td>
          <td class="mono"><b>${s.deaths}</b>/${s.people}</td>
          <td>${smellWord(s.smell)}</td>
          <td>${esc(s.waterShort)}</td>
        </tr>${s.id === ledgerOpenRow ? `<tr class="detail"><td colspan="4">${factsHtml(s)}</td></tr>` : ''}`).join('')}
      </tbody>
    </table>` : '<p>문을 두드려 세 가지를 물으면, 조사한 곳의 기록이 여기에 나란히 쌓인다.</p>';
}
$('ledger-body').addEventListener('click', e => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('tr[data-id]');
  if (!row) return;
  ledgerOpenRow = ledgerOpenRow === row.dataset.id ? '' : row.dataset.id!;
  renderLedger();
});

function toggleLedger(open?: boolean) {
  const el = $('ledger');
  const next = open ?? el.classList.contains('folded');
  el.classList.toggle('folded', !next);
  $('ledger-toggle').setAttribute('aria-expanded', String(next));
  try { localStorage.setItem('snow1854.ledger', next ? '1' : '0'); } catch { /* 무시 */ }
}
$('ledger-toggle').addEventListener('click', () => toggleLedger());
// 좁은 화면에서는 지도를 가리지 않게 접은 채로 시작한다
try { if (localStorage.getItem('snow1854.ledger') === '0' || matchMedia('(max-width: 820px)').matches) toggleLedger(false); } catch { /* 무시 */ }

function showNote(stage: number) {
  const note = NOTES[stage];
  if (!note) return;
  $('note-date').textContent = DATES[stage];
  $('note-title').textContent = note.title;
  const body = [...note.body];
  if (stage === STAGE.REASON && save.predict !== undefined) {
    body.unshift(`당신은 공기설대로라면 "${NOTES[STAGE.TEST_AIR].predict!.options[save.predict]}"라고 예상했소. 실제로는 구빈원 535명 가운데 5명, 양조장 70명 가운데 0명이었소.`);
  }
  const ask = note.predict && save.predict === undefined ? note.predict : null;
  $('note-body').innerHTML = body.map(p => `<p>${esc(p)}</p>`).join('') + (ask ? `
    <p class="ask">${esc(ask.q)}</p>
    <div class="reason-opts">${ask.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="num">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>` : '');
  $('note-body').querySelectorAll<HTMLButtonElement>('.opt').forEach(b => b.addEventListener('click', () => {
    save.predict = Number(b.dataset.i);
    sound.playPen();
    $('note-ok').click();
  }));
  $('note-ok').textContent = note.button;
  $('note-ok').classList.toggle('hidden', !!ask);
  openModal('note');
}
$('note-ok').addEventListener('click', () => {
  closeModal('note');
  const first = save.noteSeen < 0;
  save.noteSeen = Math.max(save.noteSeen, save.stage);
  persist();
  if (save.stage === STAGE.REASON || save.stage === STAGE.HEARING) notebook.open('reason');
  else if (first) toast('붉은 점선을 따라가면 지금 조사할 집이 나온다', '붉은 고리가 뜬 문을 누르면 그 앞까지 걸어가 문을 두드린다');
  if (first) showClickHint();
  if (afterNote) { const f = afterNote; afterNote = null; setTimeout(f, first ? 3600 : 300); }
});

// ---------------------------------------------------------------------------
// 진행
// ---------------------------------------------------------------------------
function setStage(stage: number) {
  save.stage = stage;
  // 다음 단계 조건을 이미 채웠다면 건너뛴다
  while (stageCleared(save.stage, has)) save.stage++;
  persist();
  updateHud(true);
  mp.sendProgress(save.records, save.stage);
  noteAt = performance.now() + 1400;
}

function addXp(n: number) { save.xp += n; }

function record(site: Site) {
  save.records.push(site.id);
  addXp(XP.record + (site.clue ? XP.clue : 0));
  if (site.clue) {
    sound.playShockAnomaly();
    flash();
    toast(site.clue, `${site.name} 기록 완료`, true);
  } else {
    sound.playClueRecorded();
    toast(`${site.name} 기록 완료`, site.deaths ? `${site.people}명 가운데 ${site.deaths}명 사망 · 지도에 검은 막대 ${site.deaths}개를 그렸다` : `${site.people}명 가운데 사망 없음`);
  }
  persist();
  if (!matchMedia('(max-width: 820px)').matches) toggleLedger(true);
  updateHud();
  mp.sendProgress(save.records, save.stage);
  if (stageCleared(save.stage, has)) setStage(save.stage + 1);
}

const notebook = new Notebook({
  records: recordedSites,
  stage: () => save.stage,
  reasonStep: () => save.reasonStep,
  answer(step, correct) {
    if (!correct) { save.misses++; sound.playWrong(); persist(); return; }
    sound.playClueRecorded();
    save.reasonStep = step + 1;
    if (save.reasonStep < REASONING.length) { persist(); return; }
    addXp(XP.reason);
    notebook.close();
    flash();
    toast('가설을 세웠다', '콜레라는 브로드 가 펌프의 물로 퍼진다', true);
    setStage(STAGE.PREDICT);
  },
  startHearing: () => { void hearing(); },
});

// ---------------------------------------------------------------------------
// 면담
// ---------------------------------------------------------------------------
const myPortrait = () => `./assets/portraits/inv_${save.look}.webp`;

function cardHtml(site: Site, asked: QuestionId[], fresh?: QuestionId) {
  return `<h3>조사 기록</h3><p class="card-name">${esc(site.name)}</p>${factsHtml(site, asked, fresh)}`;
}

async function interview(site: Site) {
  if (scene.isOpen || modalOpen() || cinematic) return;
  path = null;
  sound.playDoorKnock();
  const asked = save.asked[site.id] ?? (save.asked[site.id] = []);
  scene.open(site.name, save.name, myPortrait());
  scene.setNpc(site.npc.name, site.npc.role, portraitUrl(site.npc.portrait));
  scene.setCard(cardHtml(site, has(site.id) ? [...QUESTIONS] : asked));
  try {
    if (has(site.id)) {
      await scene.say(['(이미 기록을 마친 곳이다.)', site.outro]);
      scene.close();
      return;
    }
    await scene.say(asked.length ? ['(다시 문을 두드렸다.)'] : site.intro);
    while (asked.length < QUESTIONS.length) {
      const i = await scene.choose('무엇을 물을까?', [
        ...QUESTIONS.map(q => ({ label: QUESTION_LABEL[q], done: asked.includes(q) })),
        { label: '나중에 다시 온다', leave: true },
      ]);
      if (i === QUESTIONS.length) { scene.close(); return; }
      const q = QUESTIONS[i];
      await scene.say(site[q]);
      if (!asked.includes(q)) {
        asked.push(q);
        sound.playPen();
        scene.setCard(cardHtml(site, asked, q));
        persist();
      }
    }
    await scene.say([site.outro]);
    scene.close();
    record(site);
  } catch (e) {
    if (!(e instanceof SceneClosed)) throw e;
  }
}

// ---------------------------------------------------------------------------
// 교구 위원회
// ---------------------------------------------------------------------------
async function hearing() {
  if (scene.isOpen || save.stage !== STAGE.HEARING) return;
  scene.open('세인트 제임스 교구 회관 · 9월 7일 저녁', save.name, myPortrait());
  document.body.classList.add('in-hearing');     // 증거 고르기 화면이 기록판 구실을 한다
  scene.setNpc('위원장', '교구 위원', portraitUrl('chairman'));
  try {
    await scene.say(HEARING.intro);
    const used = new Set<string>();
    for (const round of HEARING.rounds) {
      scene.setNpc(round.speaker, '교구 위원', portraitUrl(round.portrait));
      await scene.say([round.claim]);
      for (;;) {
        const recs = recordedSites();
        const i = await scene.choose(round.ask, recs.map(s => ({
          label: s.name,
          sub: `${s.people}명 가운데 ${s.deaths}명 사망 · 악취 ${smellWord(s.smell)} · ${s.waterNote}`,
          disabled: used.has(s.id),
        })), true);
        const s = recs[i];
        const fits = s.proves.includes(round.need) && (round.need !== 'near' || s.nearestPump === 'broad');
        if (fits) {
          used.add(s.id);
          sound.playClueRecorded();
          addXp(XP.rebut);
          await scene.say(['나: ' + (s.testimonies?.[round.need] ?? s.testimony), round.ok]);
          break;
        }
        save.misses++;
        sound.playWrong();
        await scene.say([hearingRebuff(round.need, s)]);
      }
    }
    scene.setNpc('위원장', '교구 위원', portraitUrl('chairman'));
    await scene.say(HEARING.verdict);
    scene.close();
    setStage(STAGE.HANDLE);
  } catch (e) {
    if (!(e instanceof SceneClosed)) throw e;
    persist();
  }
}

// ---------------------------------------------------------------------------
// 펌프
// ---------------------------------------------------------------------------
function inspectPump(id: string) {
  const pump = PUMPS.find(p => p.id === id)!;
  if (!pump.isBroad) { toast(pump.name, '이 동네 사람들이 물을 긷는 펌프다'); return; }
  if (save.stage === STAGE.HANDLE) { removeHandle(); return; }
  if (save.stage >= STAGE.DONE) toast('손잡이가 없는 펌프', '이제 아무도 이 물을 긷지 못한다');
  else toast('맑고 찬 물이 쏟아진다', '눈으로 보아서는 아무것도 알 수 없다');
}

function removeHandle() {
  cinematic = true;
  path = null;
  renderer.zoomTarget = renderer.baseZoom * 1.5;
  sound.playPumpHandleDetach();
  setTimeout(() => {
    flash();
    sound.playVictoryFanfare();
    addXp(XP.handle);
    save.stage = STAGE.DONE;
    nearId = null;              // 펌프 앞 안내 문구를 새 단계에 맞게 다시 쓴다
    persist();
    updateHud(true);
    mp.sendProgress(save.records, save.stage);
    toast('손잡이가 떼어졌다', '1854년 9월 8일 금요일 아침', true);
  }, 800);
  setTimeout(() => { cinematic = false; openEnding(0); }, 3200);
}

// ---------------------------------------------------------------------------
// 맺음
// ---------------------------------------------------------------------------
function openEnding(page: number) {
  const last = page === EPILOGUE.length - 1;
  const p = EPILOGUE[page];
  $('ending-step').textContent = `그 뒤의 이야기 ${page + 1} / ${EPILOGUE.length}`;
  $('ending-title').textContent = p.title;
  const grade = save.misses <= 1 && save.records.length >= 12 ? '최우수' : save.misses <= 4 || save.records.length >= 10 ? '우수' : '수료';
  $('ending-body').innerHTML = p.body.map(t => `<p>${esc(t)}</p>`).join('') + (last ? `
    <div class="report">
      <div><b>${save.records.length}/${SITES.length}</b><span>조사한 곳</span></div>
      <div><b>${save.misses}</b><span>빗나간 추리</span></div>
      <div><b>${grade}</b><span>${esc(rankOf(save.xp))}</span></div>
    </div>` : '');
  const actions = $('ending-actions');
  actions.replaceChildren();
  const btn = (label: string, cls: string, fn: () => void) => {
    const b = document.createElement('button');
    b.className = 'btn ' + cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    actions.append(b);
  };
  if (page > 0) btn('이전', 'ghost', () => openEnding(page - 1));
  if (last) {
    btn('스노우의 실제 지도 보기', 'ghost', () => openModal('snowmap'));
    btn('소호로 돌아간다', 'primary', () => {
      closeModal('ending');
      if (save.records.length < SITES.length) toast('남은 집도 조사해 지도를 완성할 수 있다', '지도 단추를 누르면 전체가 보인다');
    });
  } else {
    btn('다음', 'primary', () => openEnding(page + 1));
  }
  openModal('ending');
}

// ---------------------------------------------------------------------------
// 이동과 상호작용
// ---------------------------------------------------------------------------
let clickHintTimer = 0;
function showClickHint() {
  let seen = 0;
  try { seen = Number(localStorage.getItem('snow1854.clickhint') || 0); } catch { /* 무시 */ }
  if (seen >= 2) return;
  $('hint-click').classList.remove('hidden');
  clickHintTimer = window.setTimeout(hideClickHint, 30000);
}
function hideClickHint(learned = false) {
  clearTimeout(clickHintTimer);
  $('hint-click').classList.add('hidden');
  if (!learned) return;
  try { localStorage.setItem('snow1854.clickhint', String(Number(localStorage.getItem('snow1854.clickhint') || 0) + 1)); } catch { /* 무시 */ }
}

function goTo(wx: number, wy: number, then?: () => void) {
  if (!nav.ready) return;
  const dest = nav.walkable(wx, wy) ? [wx, wy] : nav.snap(wx, wy);
  const start = nav.walkable(me.x, me.y) ? [me.x, me.y] : nav.snap(me.x, me.y);
  if (!dest || !start) return;
  const p = nav.path(start[0], start[1], dest[0], dest[1]);
  if (!p) return;
  path = p;
  onArrive = then ?? null;
  if (!$('hint-click').classList.contains('hidden')) hideClickHint(true);
}

function interact() {
  if (!nearId || cinematic || performance.now() - sceneSeenAt < 400) return;
  if (nearId.startsWith('pump:')) inspectPump(nearId.slice(5));
  else void interview(SITE_BY_ID[nearId]);
}

function onTap(sx: number, sy: number) {
  if (!started || cinematic) return;
  const site = renderer.siteAt(sx, sy);
  const [wx, wy] = renderer.toWorld(sx, sy);
  if (overview) setOverview(false);
  if (site) {
    if (Math.hypot(site.door[0] - me.x, site.door[1] - me.y) < REACH) void interview(site);
    else goTo(site.door[0], site.door[1], () => void interview(site));
    return;
  }
  const pump = PUMPS.find(p => Math.hypot(p.x - wx, p.y - 20 - wy) < 26);
  if (pump) { goTo(pump.x, pump.y, () => inspectPump(pump.id)); return; }
  goTo(wx, wy);
}

function move(dt: number) {
  let dx = 0, dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  if (keys.has('arrowup') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  const step = SPEED * dt;
  const ox = me.x, oy = me.y;

  if (dx || dy) {
    path = null; onArrive = null;
    const len = Math.hypot(dx, dy);
    [me.x, me.y] = nav.slide(me.x, me.y, dx / len * step, dy / len * step);
  } else if (path) {
    let left = step;
    while (path.length && left > 0) {
      const [tx, ty] = path[0];
      const d = Math.hypot(tx - me.x, ty - me.y);
      if (d <= left) { me.x = tx; me.y = ty; left -= d; path.shift(); }
      else { me.x += (tx - me.x) / d * left; me.y += (ty - me.y) / d * left; left = 0; }
    }
    if (!path.length) {
      path = null;
      const then = onArrive;
      onArrive = null;
      then?.();
    }
  }
  const mx = me.x - ox;
  me.moving = Math.hypot(mx, me.y - oy) > step * 0.2;
  if (Math.abs(mx) > step * 0.25) me.facing = mx > 0 ? 1 : -1;
}

let stepClock = 0;
function updateNear() {
  let best: string | null = null, bd = REACH;
  for (const s of SITES) {
    const d = Math.hypot(s.door[0] - me.x, s.door[1] - me.y);
    if (d < bd) { bd = d; best = s.id; }
  }
  for (const p of PUMPS) {
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bd) { bd = d; best = 'pump:' + p.id; }
  }
  // 손잡이를 떼러 왔을 때는 옆집 문보다 펌프가 먼저다
  if (save.stage === STAGE.HANDLE && Math.hypot(BROAD_PUMP.x - me.x, BROAD_PUMP.y - me.y) < REACH) best = 'pump:broad';
  if (best === nearId) return;
  nearId = best;
  const prompt = $('prompt');
  prompt.classList.toggle('hidden', !best || overview);
  if (!best) return;
  let label: string;
  if (best.startsWith('pump:')) {
    label = best === 'pump:broad' && save.stage === STAGE.HANDLE ? '손잡이 떼어 내기' : '펌프 살펴보기';
  } else {
    label = `${has(best) ? '다시 찾아가기' : '문 두드리기'} · ${SITE_BY_ID[best].name}`;
  }
  $('prompt-text').textContent = label;
}

function setOverview(on: boolean, withBoard = false) {
  overview = on;
  board = on && withBoard;
  renderer.focus = on ? { x: BROAD_PUMP.x, y: BROAD_PUMP.y + 60 } : null;
  renderer.zoomTarget = on ? renderer.overviewZoom : (userZoom || renderer.baseZoom);
  $('btn-map').classList.toggle('on', on && !board);
  $('btn-board').classList.toggle('on', board);
  $('board').classList.toggle('hidden', !board);
  $('quest').classList.toggle('hidden', board);
  const legend = $('legend');
  legend.classList.toggle('hidden', !on);
  legend.innerHTML = legendText();
  $('prompt').classList.toggle('hidden', !nearId || on);
  if (board) renderBoard();
}

function legendText() {
  const deaths = '검은 원 속 숫자가 사망자 수 · 가까이 보면 막대 하나가 한 사람';
  return save.stage >= STAGE.PREDICT ? `<b>붉은 길</b> 걸어서 브로드 가 펌프가 가장 가까운 거리 · ${deaths}` : deaths;
}

/** 지금 할 일 가운데 가장 가까운 곳까지 길을 따라가는 안내선을 다시 잡는다 */
function updateGuide() {
  if (!nav.ready) return;
  let best: [number, number] | null = null, bd = Infinity, name = '';
  for (const id of questView(save.stage, has, myArea()).targets) {
    const pos: [number, number] = id === 'pump' ? [BROAD_PUMP.x, BROAD_PUMP.y] : SITE_BY_ID[id].door;
    const d = Math.hypot(pos[0] - me.x, pos[1] - me.y);
    if (d < bd) { bd = d; best = pos; name = id === 'pump' ? BROAD_PUMP.name : SITE_BY_ID[id].name; }
  }
  if (!best || bd < REACH) { guide = null; return; }
  // 같은 곳으로 안내선을 따라 걷는 동안에는 다시 계산하지 않는다
  if (guide && name === guideName && Math.hypot(guide[0][0] - me.x, guide[0][1] - me.y) < 50) return;
  guideName = name;
  guide = null;
  const a = nav.walkable(me.x, me.y) ? [me.x, me.y] : nav.snap(me.x, me.y);
  const b = nav.walkable(best[0], best[1]) ? best : nav.snap(best[0], best[1]);
  if (a && b) guide = nav.path(a[0], a[1], b[0], b[1]);
}

function renderBoard() {
  const all = [{ name: save.name + ' (나)', team: save.team, records: save.records, stage: save.stage }, ...others];
  const union = new Set(all.flatMap(p => p.records));
  if (!save.room) {
    $('board').innerHTML = `<h3>혼자 조사하는 중</h3><p class="room">친구들과 함께 하려면 첫 화면에서 방 번호와 영역을 고른다.</p>`;
    return;
  }
  const full = all.length > AREA_CAP;
  $('board').innerHTML = `
    <h3>${esc(areaName(save.team))} 영역 · <span class="${full ? 'over' : ''}">${all.length} / ${AREA_CAP}명</span> · ${union.size}/${SITES.length}곳</h3>
    <p class="room">방 번호 <b class="mono">${esc(save.room)}</b><button class="btn small" data-copy>초대 주소 복사</button></p>
    ${full ? '<p class="room over">이 영역에 사람이 너무 많다. 연결이 끊길 수 있다.</p>' : ''}
    <ul>${all.map(p => `<li><span>${esc(p.name)}</span><span>${STAGE_LABEL[p.stage] ?? ''} · ${p.records.length}곳</span></li>`).join('')}</ul>
    <h4>반 전체 구역 조사</h4>
    <ul>${AREAS.map(ar => {
      const ids = districtOf(ar.id).map(s => s.id);
      const got = new Set([...(mp.classAreas[ar.id] ?? []), ...(ar.id === save.team ? [...union] : [])]);
      const n = ids.filter(id => got.has(id)).length;
      return `<li style="--c:${ar.color}"><span><i class="swatch"></i>${esc(ar.name)}</span><span>${n} / ${ids.length}곳</span></li>`;
    }).join('')}</ul>
    <p class="room"><button class="btn small" data-move>다른 영역으로 옮기기</button></p>`;
}

// ---------------------------------------------------------------------------
// 입력
// ---------------------------------------------------------------------------
window.addEventListener('keydown', e => {
  if (!started || scene.isOpen) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (notebook.isOpen) notebook.close();
    else if (overview) setOverview(false);
    ['help', 'snowmap', 'about', 'primer'].forEach(closeModal);
    return;
  }
  if (k === 'r' && !modalOpen()) { toggleLedger(); return; }
  if (k === 'n' && (!modalOpen() || notebook.isOpen)) { notebook.isOpen ? notebook.close() : notebook.open(); return; }
  if (modalOpen() || cinematic) return;
  if (k === 'm') { setOverview(!overview || board); return; }
  if (k === 'b') { setOverview(!board, true); return; }
  if (k === 'e' || k === ' ' || k === 'enter') { e.preventDefault(); interact(); return; }
  keys.add(k);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

const canvas = $<HTMLCanvasElement>('map');
canvas.addEventListener('pointerdown', e => onTap(e.clientX, e.clientY));
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (overview) return;
  // 소호 전체가 한 화면에 들어올 때까지 줄일 수 있다
  userZoom = Math.max(renderer.overviewZoom, Math.min(3.4, (userZoom || renderer.baseZoom) * (e.deltaY < 0 ? 1.1 : 0.9)));
  renderer.zoomTarget = userZoom;
}, { passive: false });

$('prompt').addEventListener('click', interact);
$('btn-notebook').addEventListener('click', () => notebook.open());
$('ledger-open').addEventListener('click', () => { if (!scene.isOpen) notebook.open('compare'); });
$('btn-map').addEventListener('click', () => setOverview(!overview || board));
$('btn-board').addEventListener('click', () => setOverview(!board, true));
$('btn-help').addEventListener('click', () => openModal('help'));
$('help-close').addEventListener('click', () => closeModal('help'));
$('help-note').addEventListener('click', () => {
  closeModal('help');
  if (save.stage >= STAGE.DONE) openEnding(0); else showNote(save.stage);
});
$('snowmap-close').addEventListener('click', () => closeModal('snowmap'));
$('about-body').innerHTML = SOURCES.map(s => `<h3>${esc(s.title)}</h3><ul>${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
$('help-about').addEventListener('click', () => { closeModal('help'); openModal('about'); });
$('primer-body').innerHTML = PRIMER.map(s => `<h2>${esc(s.title)}</h2>${s.body.map(b => `<p>${esc(b)}</p>`).join('')}`).join('')
  + `<h2>낱말 풀이</h2><dl class="glossary">${GLOSSARY.map(([w, d]) => `<dt>${esc(w)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`;
$('btn-primer').addEventListener('click', () => openModal('primer'));
$('help-primer').addEventListener('click', () => { closeModal('help'); openModal('primer'); });
$('primer-close').addEventListener('click', () => closeModal('primer'));
$('about-close').addEventListener('click', () => closeModal('about'));
$('about-reset').addEventListener('click', () => {
  const b = $('about-reset');
  // 실수로 지우지 않게 두 번 눌러야 한다
  if (b.dataset.armed) { localStorage.removeItem(SAVE_KEY); location.reload(); return; }
  b.dataset.armed = '1';
  b.textContent = '기록이 모두 지워진다. 한 번 더 누르면 지운다';
});
$('board').addEventListener('click', e => {
  if ((e.target as HTMLElement).closest('[data-move]')) {
    // 조사 기록은 그대로 두고 첫 화면으로 돌아가 영역만 다시 고른다
    persist();
    location.hash = `class=${encodeURIComponent(save.room)}`;
    location.reload();
    return;
  }
  if (!(e.target as HTMLElement).closest('[data-copy]')) return;
  const link = `${location.origin}${location.pathname}#class=${encodeURIComponent(save.room)}`;
  void navigator.clipboard?.writeText(link).then(() => toast('초대 주소를 복사했다', link));
});
$('btn-sound').addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  $('btn-sound').classList.toggle('off', !sound.enabled);
  $('sound-label').textContent = sound.enabled ? '소리' : '소리 끔';
});

// ---------------------------------------------------------------------------
// 입장
// ---------------------------------------------------------------------------
function radioGroup(id: string, value: string, onPick: (v: string) => void) {
  const buttons = [...$(id).querySelectorAll<HTMLButtonElement>('.pick')];
  const set = (v: string) => { buttons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === v))); onPick(v); };
  buttons.forEach(b => b.addEventListener('click', () => set(b.dataset.value!)));
  set(value);
}

let lobbyMode = 'solo';
function setupLobby() {
  $('in-team').innerHTML = AREAS.map(t => `<button type="button" class="pick" data-value="${t.id}" role="radio" style="--c:${t.color}"><i></i><span>${t.name}</span><small>최대 ${AREA_CAP}명</small></button>`).join('');
  // 초대 주소: #class=방번호(&all=1). '#r=' 은 연결 라이브러리가 제 방 이름을 적는 자리라 쓰지 않는다
  const link = new URLSearchParams(location.hash.slice(1));
  const room = link.get('class') || save.room;
  // 혼자 조사 / 친구들과 함께: 언제든 다시 고를 수 있다
  radioGroup('in-mode', room ? 'class' : 'solo', v => {
    lobbyMode = v;
    $('room-row').classList.toggle('hidden', v !== 'class');
    $('area-row').classList.toggle('hidden', v !== 'class');
    if (v === 'class' && started === false && document.activeElement?.closest('#in-mode')) $<HTMLInputElement>('in-room').focus();
  });
  $<HTMLInputElement>('in-name').value = save.name;
  $<HTMLInputElement>('in-room').value = room;
  $('in-look').innerHTML = LOOKS.map(l => `<button type="button" class="pick" data-value="${l}" role="radio" aria-label="조사관 ${l}"><img src="./assets/portraits/inv_${l}.webp" alt=""></button>`).join('');
  radioGroup('in-look', LOOKS.includes(save.look) ? save.look : 'f1', v => { save.look = v; });
  radioGroup('in-team', save.team, v => { save.team = v; });
  const resumable = save.records.length > 0 || save.noteSeen >= 0;
  $('btn-start').textContent = resumable ? '이어서 조사하기' : '조사 시작';
  $('btn-reset').classList.toggle('hidden', !resumable);
  $('btn-reset').addEventListener('click', () => {
    save = freshSave(save);
    $('btn-start').textContent = '조사 시작';
    $('btn-reset').classList.add('hidden');
  });
  $('lobby-form').addEventListener('submit', e => {
    e.preventDefault();
    if (lobbyMode === 'class' && !$<HTMLInputElement>('in-room').value.trim()) {
      $('room-error').classList.remove('hidden');
      $<HTMLInputElement>('in-room').focus();
      return;
    }
    void start();
  });
  $('in-room').addEventListener('input', () => $('room-error').classList.add('hidden'));
}

async function start() {
  save.name = $<HTMLInputElement>('in-name').value.trim() || '조사관';
  save.room = lobbyMode === 'class' ? $<HTMLInputElement>('in-room').value.trim().replace(/[^0-9A-Za-z가-힣]/g, '') : '';
  Object.assign(me, { name: save.name, team: save.team, look: save.look });
  await navReady;

  // 처음이면 고른 영역의 시작 장소에서 (혼자일 때는 브로드 가 펌프 앞에서) 출발한다
  const area = save.room ? AREAS.find(a => a.id === save.team) : undefined;
  const startAt = area ? [area.start[0] * WORLD_SCALE, area.start[1] * WORLD_SCALE] : [BROAD_PUMP.x, BROAD_PUMP.y - 14];
  const fresh = save.startKey !== (save.room ? `${save.room}|${save.team}` : 'solo');
  const startKey = save.room ? `${save.room}|${save.team}` : 'solo';
  if (save.startKey !== startKey) { save.x = 0; save.y = 0; save.startKey = startKey; }
  const spawn = save.x ? [save.x, save.y] : startAt;
  [me.x, me.y] = nav.snap(spawn[0], spawn[1]) ?? [BROAD_PUMP.x, BROAD_PUMP.y];
  renderer.jumpTo(me.x, me.y);

  $('lobby').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('ledger').classList.remove('hidden');
  started = true;
  updateHud();
  persist();
  // 쪽지가 뜰 참이면 쪽지를 닫은 뒤에 알린다 (쪽지가 알림을 가린다)
  if (area && fresh) {
    const say = () => toast(`${area.name}에서 출발한다`, `${area.name} 영역이 맡은 집 ${SITES.filter(s => s.area === area.id).length}곳에 점선 고리가 있다. 다른 영역의 기록도 저절로 모인다`, true);
    if (save.noteSeen < save.stage) afterNote = say; else setTimeout(say, 600);
  }
  mp.onJoin = name => tick(`${name} 조사관이 합류했다`);
  mp.onRecord = (name, team, id) => tick(`${name} · ${SITE_BY_ID[id]?.name ?? id} 기록`, teamColor(team));
  mp.onFinish = name => tick(`${name} 조사관이 펌프 손잡이를 떼어 냈다`);
  mp.onFail = () => toast('친구들과 연결하지 못했다', '혼자서도 끝까지 조사할 수 있다. 다시 하려면 새로 고친다');
  // 방 번호가 없으면 혼자 조사한다 (연결하지 않는다). 영역마다 따로 방을 쓴다
  // '3반'처럼 한글이 섞여도 되도록, 연결 서비스에는 글자마다 숫자로 바꾼 이름을 넘긴다
  const roomCode = `${Array.from(save.room, c => c.codePointAt(0)!.toString(36)).join('')}A${save.team.slice(-1)}`;
  const roomBase = Array.from(save.room, c => c.codePointAt(0)!.toString(36)).join('');
  if (save.room) void mp.connect(roomCode, me, `${roomBase}H`, save.team).then(() => mp.sendProgress(save.records, save.stage));
}

// ---------------------------------------------------------------------------
// 매 프레임
// ---------------------------------------------------------------------------
let last = performance.now();
let slowClock = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (started) {
    const paused = scene.isOpen || modalOpen() || cinematic;
    if (scene.isOpen) sceneSeenAt = now;
    document.body.classList.toggle('in-scene', scene.isOpen);
    if (!scene.isOpen) document.body.classList.remove('in-hearing');
    if (!paused && save.noteSeen < save.stage && save.stage < STAGE.DONE && now > noteAt) showNote(save.stage);
    if (paused) { keys.clear(); me.moving = false; } else if (nav.ready) move(dt);
    if (me.moving) {
      stepClock -= dt;
      if (stepClock <= 0) { sound.playFootstep(); stepClock = 0.34; }
    }
    updateNear();
    while (guide && guide.length > 1 && Math.hypot(guide[0][0] - me.x, guide[0][1] - me.y) < 14) guide.shift();
    others = mp.others();
    mp.sendPosition(me);
    slowClock -= dt;
    if (slowClock <= 0) {
      slowClock = 0.5;
      $('hud-place').textContent = placeName(me.x, me.y);
      if (board) renderBoard();
      if (me.moving) persist();
      if (!overview) {
        const far = renderer.zoom < 1.15;
        $('legend').classList.toggle('hidden', !far);
        if (far) $('legend').innerHTML = legendText();
      }
      const friendCount = new Set([...others.flatMap(o => o.records), ...Object.values(mp.classAreas).flat()].filter(id => !has(id))).size;
      if (ledgerKey !== `${save.records.length}|${friendCount}`) renderLedger();
      if (others.length >= AREA_CAP && !crowdWarned) {
        crowdWarned = true;
        toast(`${areaName(save.team)} 영역이 가득 찼다`, `한 영역에 ${AREA_CAP}명까지 권한다. 함께 단추에서 다른 영역으로 옮길 수 있다`, true);
      }
      updateGuide();
    }
  }
  const quest = questView(save.stage, has, myArea());
  renderer.draw({
    me, others,
    records: new Set(save.records),
    classRecords: new Set([...others.flatMap(o => o.records), ...Object.values(mp.classAreas).flat()]),
    targets: new Set(started ? quest.targets : []),
    nearId, path,
    guide: started && !scene.isOpen ? guide : null,
    guideName,
    handleRemoved: save.stage >= STAGE.DONE,
    district: new Set(districtOf(myArea()).map(s => s.id)),
    districtColor: teamColor(myArea()),
    showFog: save.stage < STAGE.PREDICT,
    showCatchment: overview && save.stage >= STAGE.PREDICT,
    board,
    time: now / 1000,
  });
  requestAnimationFrame(frame);
}

setupLobby();
renderer.jumpTo(BROAD_PUMP.x, BROAD_PUMP.y);
requestAnimationFrame(frame);

// 개발 서버에서만: tools/playtest.mjs 가 게임 상태를 들여다보는 창구
if (import.meta.env.DEV) {
  Object.assign(window, {
    __game: {
      state: () => ({ ...save, near: nearId, others: others.map(o => o.name), x: me.x, y: me.y, walking: !!path, guide: guide?.length ?? -1, guideName }),
      doorOnScreen: (id: string) => renderer.toScreen(...SITE_BY_ID[id].door),
      iconOnScreen: (id: string) => renderer.toScreen(SITE_BY_ID[id].icon[0], SITE_BY_ID[id].icon[1] - 12),
      teleport: (x: number, y: number) => { [me.x, me.y] = nav.snap(x, y) ?? [me.x, me.y]; path = null; },
      door: (id: string) => SITE_BY_ID[id].door,
      pump: () => [BROAD_PUMP.x, BROAD_PUMP.y],
      nav,
      peerRecords: () => others.reduce((n, o) => n + o.records.length, 0),
      classRecordCount: () => new Set(Object.values(mp.classAreas).flat()).size,
    },
  });
}
