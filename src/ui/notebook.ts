import { Site, Smell } from '../types.ts';
import { SITES, STAGE, REASONING, WATER_GROUPS, questView, smellWord } from '../data/story.ts';
import { Seen, InquiryState, DIST_BANDS, DIST_NEED, DIST_PREDICT, BADGES, SKILL_NAMES, LEVEL_NAMES, distToBroad, skills, level, predStats } from '../data/inquiry.ts';
import { esc, factsHtml, basisTag } from './cards.ts';

type Tab = 'records' | 'compare' | 'graph' | 'reason' | 'inquiry';
/** 그래프를 그리기 시작할 만큼의 기록 수 */
const GRAPH_MIN = 5;

export interface NotebookHost {
  records(): Site[];
  stage(): number;
  reasonStep(): number;
  /** 추리 문항에 답했다. 맞으면 true */
  answer(step: number, correct: boolean): void;
  startHearing(): void;
  seen(): Seen;
  markSeen(key: keyof Seen): void;
  distPredict(): number | undefined;
  setDistPredict(i: number): void;
  inquiry(): InquiryState;
  badges(): string[];
}

/** 조사 수첩: 기록을 모으고, 견주고, 추리하는 곳 */
export class Notebook {
  private root = document.getElementById('notebook')!;
  private body = document.getElementById('notebook-body')!;
  private tabs = [...this.root.querySelectorAll<HTMLButtonElement>('.tab')];
  private tab: Tab = 'records';
  private groupBy: 'smell' | 'water' = 'smell';
  private why = '';

  constructor(private host: NotebookHost) {
    this.tabs.forEach(t => t.addEventListener('click', () => this.show(t.dataset.tab as Tab)));
    document.getElementById('notebook-close')!.addEventListener('click', () => this.close());
    this.root.addEventListener('click', e => { if (e.target === this.root) this.close(); });
  }

  public get isOpen() { return this.root.classList.contains('open'); }

  public open(tab?: Tab) {
    this.why = '';
    this.root.classList.add('open');
    this.show(tab ?? (this.needsReason ? 'reason' : 'records'));
  }

  public close() { this.root.classList.remove('open'); }

  /** 추리 쪽에 할 일이 있는가 (붉은 점 표시용) */
  public get needsReason() {
    const s = this.host.stage();
    return s === STAGE.REASON || s === STAGE.HEARING;
  }

  private show(tab: Tab) {
    this.tab = tab;
    this.tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    document.getElementById('reason-dot')!.classList.toggle('hidden', !this.needsReason);
    if (tab === 'records') this.renderRecords();
    else if (tab === 'compare') this.renderCompare();
    else if (tab === 'graph') this.renderGraph();
    else if (tab === 'inquiry') this.renderInquiry();
    else this.renderReason();
    this.body.scrollTop = 0;
  }

  private renderRecords() {
    const recs = this.host.records();
    const blanks = Math.min(SITES.length - recs.length, 3);
    this.body.innerHTML = `
      <h3>조사 기록 ${recs.length} / ${SITES.length}곳</h3>
      <p class="sub">${recs.length ? '집집마다 같은 세 가지를 물어 적었다.' : '아직 기록이 없다. 문을 두드려 세 가지를 물어라.'}</p>
      <div class="cards">
        ${recs.map(s => `
          <section class="rec">
            <h4>${esc(s.name)}</h4>
            ${factsHtml(s)}
            ${s.clue ? `<p class="clue">${esc(s.clue)}</p>` : ''}
            ${basisTag(s)}
          </section>`).join('')}
        ${'<section class="rec blank">?</section>'.repeat(blanks)}
      </div>`;
  }

  private renderCompare() {
    const recs = this.host.records();
    if (recs.length < 2) {
      this.body.innerHTML = `<h3>기록을 나란히 놓고 견주기</h3><p class="sub">기록이 두 곳 넘게 모이면 견줄 수 있다.</p>`;
      return;
    }
    const smell = (v: Smell) => (s: Site) => s.smell === v;
    const defs: [string, (s: Site) => boolean][] = this.groupBy === 'smell'
      ? [['악취가 심한 곳', smell('high')], ['악취가 보통인 곳', smell('mid')], ['악취가 약한 곳', smell('low')]]
      : WATER_GROUPS.map(([kind, label]): [string, (s: Site) => boolean] => [label, s => s.waterKind === kind]);
    const groups = defs.map(([label, test]) => {
      const sites = recs.filter(test);
      const people = sites.reduce((n, s) => n + s.people, 0), deaths = sites.reduce((n, s) => n + s.deaths, 0);
      return { label, sites, people, deaths, rate: people ? deaths / people * 100 : 0 };
    }).filter(g => g.sites.length);
    const max = Math.max(...groups.map(g => g.rate), 0.001);

    this.body.innerHTML = `
      <h3>기록을 나란히 놓고 견주기</h3>
      <p class="sub">같은 기록을 두 가지 기준으로 묶어 본다. 어느 쪽이 죽음을 더 뚜렷이 가르는가?</p>
      <div class="seg">
        <button data-by="smell" aria-pressed="${this.groupBy === 'smell'}">악취로 묶기</button>
        <button data-by="water" aria-pressed="${this.groupBy === 'water'}">마시는 물로 묶기</button>
      </div>
      ${groups.map(g => `
        <section class="group${g.rate === max && groups.length > 1 ? ' worst' : ''}">
          <div class="group-head">
            <strong>${g.label}</strong>
            <span>${g.sites.length}곳 · ${g.people}명 가운데 <b>${g.deaths}</b>명 사망 · 백 명에 <b>${g.rate.toFixed(1)}</b>명</span>
          </div>
          <div class="bar"><i style="width:0" data-w="${(g.rate / max * 100).toFixed(1)}"></i></div>
        </section>`).join('')}
      <h3 class="table-title">곳마다 나란히 놓기 <small>사망 비율이 높은 곳부터</small></h3>
      <table class="data">
        <thead><tr><th>조사한 곳</th><th>사망</th><th>백 명에</th><th>악취</th><th>마시는 물</th></tr></thead>
        <tbody>${[...recs].sort((a, b) => b.deaths / b.people - a.deaths / a.people).map(s => `
          <tr>
            <td>${esc(s.name)}</td>
            <td class="num">${s.deaths} / ${s.people}</td>
            <td class="num"><b>${(s.deaths / s.people * 100).toFixed(1)}</b></td>
            <td>${smellWord(s.smell)}</td>
            <td>${esc(s.waterShort)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    this.body.querySelectorAll<HTMLButtonElement>('.seg button').forEach(b => b.addEventListener('click', () => {
      this.groupBy = b.dataset.by as 'smell' | 'water';
      this.renderCompare();
    }));
    if (recs.length >= GRAPH_MIN) this.host.markSeen('table');
    // 막대가 0 에서 자라나도록 한 박자 늦춘다
    requestAnimationFrame(() => this.body.querySelectorAll<HTMLElement>('.bar i').forEach(i => { i.style.width = i.dataset.w + '%'; }));
  }

  private renderReason() {
    const stage = this.host.stage();
    const has = (id: string) => this.host.records().some(s => s.id === id);
    const quest = questView(stage, has);
    const checklist = `<ul class="steps">${quest.items.map(i => `<li class="${i.done ? 'done' : ''}">${esc(i.label)}</li>`).join('')}</ul>`;

    if (stage < STAGE.REASON) {
      this.body.innerHTML = `
        <h3>아직 추리하기에는 기록이 모자라다</h3>
        <p class="sub">당국의 생각: 콜레라는 썩은 공기, 독기 때문에 생긴다.</p>
        <p>지금 할 일 — ${esc(quest.title)}</p>${checklist}`;
    } else if (stage === STAGE.REASON && !(this.host.seen().smell && this.host.seen().water)) {
      this.body.innerHTML = `
        <h3>추리하기 전에, 기록을 그래프로 그려 보라</h3>
        <p class="sub">숫자를 늘어놓기만 해서는 잘 보이지 않는다. 같은 기록을 냄새별로, 또 마시는 물별로 묶어 그려 본다.</p>${checklist}
        <div class="actions"><button id="go-graph" class="btn primary">그래프 쪽으로</button></div>`;
      document.getElementById('go-graph')!.addEventListener('click', () => this.show('graph'));
    } else if (stage === STAGE.REASON) {
      const step = this.host.reasonStep();
      const item = REASONING[step];
      this.body.innerHTML = `
        <p class="sub">추리 ${step + 1} / ${REASONING.length} · 헷갈리면 그래프 쪽을 다시 보라.</p>
        <h3>${esc(item.q)}</h3>
        <div class="reason-opts">
          ${item.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="num">${i + 1}</span><span>${esc(o.text)}</span></button>`).join('')}
        </div>
        ${this.why ? `<p class="why"><small>스노우 박사</small>${esc(this.why)}</p>` : ''}`;
      this.body.querySelectorAll<HTMLButtonElement>('.opt').forEach(b => b.addEventListener('click', () => {
        const o = item.options[Number(b.dataset.i)];
        this.why = o.ok ? '' : o.why!;
        this.host.answer(step, !!o.ok);
        if (this.isOpen) this.show('reason');
      }));
    } else if (stage === STAGE.PREDICT) {
      this.body.innerHTML = `
        <p class="sub">새로 세운 가설</p>
        <h3>콜레라는 브로드 가 펌프의 물로 퍼진다</h3>
        <p>가설이 옳다면 이런 사람들이 있어야 하고, 그래프는 이런 모양이어야 한다. 찾아가고 그려서 확인하라.</p>${checklist}`;
    } else if (stage === STAGE.HEARING) {
      this.body.innerHTML = `
        <p class="sub">9월 7일 목요일 저녁</p>
        <h3>세인트 제임스 교구 위원회에 보고한다</h3>
        <p>위원들이 반박할 때마다 알맞은 기록 한 장을 내놓아야 한다. 기록 쪽을 한 번 더 훑어보고 가도 좋다.</p>
        <div class="actions"><button id="go-hearing" class="btn primary">위원회에 들어간다</button></div>`;
      document.getElementById('go-hearing')!.addEventListener('click', () => { this.close(); this.host.startHearing(); });
    } else {
      this.body.innerHTML = `
        <p class="sub">기록이 뒷받침한 가설</p>
        <h3>콜레라는 브로드 가 펌프의 물로 퍼졌다</h3>
        <ul class="steps">
          <li class="done">악취가 심해도 거의 죽지 않은 곳이 있었다</li>
          <li class="done">펌프 곁에 살아도 그 물을 마시지 않은 사람은 무사했다</li>
          <li class="done">멀리 살아도 그 물을 마신 사람은 죽었다</li>
        </ul>
        <p>${stage === STAGE.HANDLE ? '위원회가 손잡이를 떼기로 했다. 브로드 가 펌프로 가라.' : '손잡이는 떼어졌다. 남은 집도 마저 조사해 지도를 완성할 수 있다.'}</p>`;
    }
  }

  // -------------------------------------------------------------------------
  // 그래프 쪽
  // -------------------------------------------------------------------------
  private renderGraph() {
    const recs = this.host.records();
    const stage = this.host.stage();
    if (recs.length < GRAPH_MIN) {
      this.body.innerHTML = `<h3>기록을 그래프로 바꾸기</h3><p class="sub">기록이 ${GRAPH_MIN}곳 넘게 모이면 그래프를 그릴 수 있다. 지금 ${recs.length}곳.</p>`;
      return;
    }
    // 묶음마다 사는 사람 백 명에 몇 명이 죽었나 (비교 쪽과 같은 잣대).
    // '사망자가 난 집의 비율'로 그리면 535명이 사는 구빈원도 작은 집 하나와 같은 무게가 되어, 사망 5명뿐인 우물 묶음이 50%로 부풀었다.
    // 스노우도 구빈원을 이렇게(사람 수에 견준 사망) 따졌다
    const rate = (sites: Site[]) => {
      const people = sites.reduce((a, s) => a + s.people, 0), deaths = sites.reduce((a, s) => a + s.deaths, 0);
      return { n: sites.length, people, deaths, v: people ? deaths / people * 100 : 0 };
    };
    const bySmell = ([['심함', 'high'], ['보통', 'mid'], ['약함', 'low']] as [string, Smell][])
      .map(([label, k]) => ({ label, ...rate(recs.filter(s => s.smell === k)) })).filter(g => g.n > 0);
    const SHORT: Record<string, string> = { broad: '브로드 가 펌프', pump: '다른 펌프', well: '건물 안 우물', pipe: '수도 회사 물', none: '안 마심' };
    // 기록에 한 곳도 없는 갈래는 그리지 않는다
    const byWater = WATER_GROUPS.map(([k, label]) => ({ label: SHORT[k] ?? label, ...rate(recs.filter(s => s.waterKind === k)) })).filter(g => g.n > 0);
    // 두 그래프의 세로 눈금을 같게 해야 견줄 수 있다
    const top = niceMax(Math.max(...bySmell.map(g => g.v), ...byWater.map(g => g.v), 1));

    const distOpen = stage >= STAGE.PREDICT;
    const enough = recs.length >= DIST_NEED;
    const pred = this.host.distPredict();
    let dist = '';
    if (!distOpen) {
      dist = `<p class="locked">새 가설을 세우면 열린다. 그 가설이 맞는지 이 그래프로 시험하게 된다.</p>`;
    } else if (!enough) {
      dist = `<p class="locked">기록이 ${DIST_NEED}곳 넘게 모여야 그릴 수 있다. 지금 ${recs.length}곳. 펌프 가까운 곳과 먼 곳을 고루 조사하라.</p>`;
    } else if (pred === undefined) {
      dist = `<p class="ask">${esc(DIST_PREDICT.q)}</p><p class="sub">그리기 전에 먼저 예상하라.</p>
        <div class="reason-opts">${DIST_PREDICT.options.map((o, i) => `<button class="opt" data-pred="${i}"><span class="num">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
    } else {
      const bands = DIST_BANDS.map((b, i) => {
        const lo = i ? DIST_BANDS[i - 1].max : 0;
        const sites = recs.filter(s => { const d = distToBroad(s); return d >= lo && d < b.max; });
        return { label: b.label, n: sites.length, v: sites.length ? sites.reduce((a, s) => a + s.deaths, 0) / sites.length : 0, sites };
      });
      const shape = bands[0].v > bands[bands.length - 1].v ? 1 : bands[0].v < bands[bands.length - 1].v ? 0 : 2;
      dist = '<section class="dist-chart">' + columnChart(bands.map(b => ({ label: b.label, v: b.v, note: `${b.n}곳`, dots: b.sites.map(s => s.deaths) })), niceMax(Math.max(...bands.map(b => b.v), ...recs.map(s => s.deaths), 1)), '집마다 사망자 (막대: 평균, 점: 한 집)', 1) + '</section>'
        + `<p class="verdict ${pred === shape ? 'hit' : ''}">당신의 예상: <b>${esc(DIST_PREDICT.options[pred])}</b> · 그래프: <b>${esc(DIST_PREDICT.options[shape])}</b>${pred === shape ? ' · 예상이 맞았다' : ' · 예상과 다르다. 왜 그럴까?'}</p>`;
    }

    this.body.innerHTML = `
      <h3>기록을 그래프로 바꾸기</h3>
      <p class="sub">기록 ${recs.length}곳. 같은 기록을 두 가지로 묶어, 묶음마다 사는 사람 백 명에 몇 명이 죽었는지 그린다. 두 그래프의 세로 눈금은 같다.</p>
      <div class="charts">
        <section><h4>냄새로 묶으면</h4>${columnChart(bySmell.map(g => ({ label: g.label, v: g.v, note: `${g.n}곳 · ${g.people}명 중 ${g.deaths}명` })), top, '백 명에 사망 (명)', 1)}</section>
        <section><h4>마시는 물로 묶으면</h4>${columnChart(byWater.map(g => ({ label: g.label, v: g.v, note: `${g.n}곳 · ${g.people}명 중 ${g.deaths}명` })), top, '백 명에 사망 (명)', 1)}</section>
      </div>
      <p class="sub">어느 쪽으로 묶었을 때 죽음이 한 묶음에 더 또렷하게 몰리는가? 한 묶음만 유난히 높고 나머지는 0에 가까운 쪽이 죽음과 더 관련 있다. (사망자 수는 스노우의 기록, 집마다 사는 사람 수는 대부분 어림값이다.)</p>
      <h3 class="table-title">브로드 가 펌프에서의 거리와 사망</h3>
      ${dist}`;
    this.body.querySelectorAll<HTMLButtonElement>('[data-pred]').forEach(b => b.addEventListener('click', () => {
      this.host.setDistPredict(Number(b.dataset.pred));
      this.renderGraph();
    }));
    this.host.markSeen('smell');
    this.host.markSeen('water');
    if (distOpen && enough && pred !== undefined) this.host.markSeen('dist');
  }

  // -------------------------------------------------------------------------
  // 탐구 쪽: 탐구력과 배지
  // -------------------------------------------------------------------------
  private renderInquiry() {
    const st = this.host.inquiry();
    const sk = skills(st), lv = level(st);
    const got = new Set(this.host.badges());
    const ps = predStats(st);
    const tips: Record<string, string> = {
      observe: '집을 더 많이 조사하면 오른다',
      compare: '비교 표와 그래프를 그려 보면 오른다',
      reason: '추리 문제를 풀면 오른다. 틀리지 않을수록 높다',
      verify: '예상을 적고, 가설을 시험하는 집을 찾아가면 오른다',
    };
    this.body.innerHTML = `
      <h3>탐구력 ${lv.lv}단계 · ${LEVEL_NAMES[lv.lv]}</h3>
      <p class="sub">과학자는 많이 보고, 견주고, 생각하고, 시험한다. 네 가지가 고루 자라야 다음 단계가 된다.</p>
      <div class="skills">${(Object.keys(sk) as (keyof typeof sk)[]).map(k => `
        <div class="skill"><div class="skill-head"><b>${SKILL_NAMES[k]}</b><span class="mono">${sk[k]}</span></div>
          <div class="meter"><i style="width:${sk[k]}%"></i></div><small>${tips[k]}</small></div>`).join('')}
      </div>
      <h3 class="table-title">예상과 예외</h3>
      ${this.host.stage() >= STAGE.PREDICT ? '<p class="sub">예외 사례는 까닭을 밝힌 곳 / 찾은 곳. 가설을 세우기 전에 기록한 곳은 다시 찾아가면 까닭을 밝힐 수 있다.</p>' : ''}
      ${this.host.stage() < STAGE.PREDICT
        ? '<p class="sub">새 가설을 세운 뒤부터는 문을 두드리기 전에 결과를 예상한다. 빗나간 예상과 예외 사례는 까닭을 밝히면 더 큰 배움이 된다.</p>'
        : `<div class="skills">
        <div class="skill"><div class="skill-head"><b>예상 적중</b><span class="mono">${ps.hit} / ${ps.n}</span></div>
          <div class="meter"><i style="width:${ps.n ? Math.round(ps.hit / ps.n * 100) : 0}%"></i></div><small>문을 두드리기 전에 사망자가 났을지 예상한다</small></div>
        <div class="skill"><div class="skill-head"><b>빗나간 예상에서 배우기</b><span class="mono">${ps.learned} / ${ps.missed}</span></div>
          <div class="meter"><i style="width:${ps.missed ? Math.round(ps.learned / ps.missed * 100) : 0}%"></i></div><small>틀린 예상도 까닭을 밝히면 점수가 된다</small></div>
        <div class="skill"><div class="skill-head"><b>예외 · 펌프 곁인데 무사</b><span class="mono">${ps.nearWhy} / ${ps.near}</span></div>
          <div class="meter"><i style="width:${ps.near ? Math.round(ps.nearWhy / ps.near * 100) : 0}%"></i></div><small>펌프가 코앞인데 아무도 죽지 않은 곳</small></div>
        <div class="skill"><div class="skill-head"><b>예외 · 멀리서 사망</b><span class="mono">${ps.farWhy} / ${ps.far}</span></div>
          <div class="meter"><i style="width:${ps.far ? Math.round(ps.farWhy / ps.far * 100) : 0}%"></i></div><small>다른 펌프가 더 가까운데 사망자가 난 곳</small></div>
      </div>`}
      <h3 class="table-title">탐구 배지 ${got.size} / ${BADGES.length}</h3>
      <div class="badges">${BADGES.map(b => `
        <div class="badge ${got.has(b.id) ? 'on' : ''}">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="6"/><path d="M8.5 15 7 21l5-2.5L17 21l-1.5-6"/>${got.has(b.id) ? '<path d="m9.5 10 1.8 1.8 3.4-3.6"/>' : ''}</svg>
          <div><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>
        </div>`).join('')}
      </div>`;
  }

  /** 열려 있는 쪽을 다시 그린다 (기록이 바뀌었을 때) */
  public refresh() { if (this.isOpen) this.show(this.tab); }
}

/** 보기 좋은 눈금 꼭대기 값 */
function niceMax(v: number) {
  const steps = [1, 2, 2.5, 5, 10];
  const mag = 10 ** Math.floor(Math.log10(v));
  return steps.map(s => s * mag).find(s => s >= v) ?? 10 * mag;
}

/** 세로 막대그래프 (SVG). 가장 높은 막대는 붉게. dots 가 있으면 한 집 한 집을 점으로 겹쳐 찍는다 */
function columnChart(cols: { label: string; v: number; note: string; dots?: number[] }[], top: number, yLabel: string, digits = 1) {
  const W = 420, H = 262, L = 40, B = 46, T = 34, R = 8;
  const cw = (W - L - R) / cols.length, ph = H - B - T;
  const y = (v: number) => T + ph - v / top * ph;
  const maxV = Math.max(...cols.map(c => c.v));
  const ticks = [0, top / 2, top];
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${yLabel}">`;
  for (const tv of ticks) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(tv)}" y2="${y(tv)}" class="grid"/><text x="${L - 6}" y="${y(tv) + 4}" text-anchor="end" class="tick">${+tv.toFixed(1)}</text>`;
  }
  s += `<text x="4" y="13" class="axis">${yLabel}</text>`;
  cols.forEach((c, i) => {
    const x = L + i * cw + cw * 0.18, w = cw * 0.64;
    const hi = c.v === maxV && c.v > 0 && cols.length > 1;
    s += `<rect x="${x}" y="${y(c.v)}" width="${w}" height="${Math.max(0, T + ph - y(c.v))}" class="${hi ? 'col hi' : 'col'}"><animate attributeName="height" from="0" to="${Math.max(0, T + ph - y(c.v))}" dur="0.6s"/><animate attributeName="y" from="${T + ph}" to="${y(c.v)}" dur="0.6s"/></rect>`;
    if (!c.note.startsWith('0곳')) s += `<text x="${x + w / 2}" y="${y(c.v) - 5}" text-anchor="middle" class="val">${c.v.toFixed(digits)}</text>`;
    (c.dots ?? []).forEach((d, k) => {
      const dx = x + w / 2 + ((k * 37) % 21 - 10) * (w / 30);
      s += `<circle cx="${dx}" cy="${y(Math.min(d, top))}" r="3.2" class="dot"/>`;
    });
    s += `<text x="${x + w / 2}" y="${H - B + 18}" text-anchor="middle" class="lab">${c.label}</text>`;
    s += `<text x="${x + w / 2}" y="${H - B + 36}" text-anchor="middle" class="note">${c.note}</text>`;
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" class="base"/></svg>`;
  return s;
}
