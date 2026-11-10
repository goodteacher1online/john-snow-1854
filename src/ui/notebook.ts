import { Site, Smell } from '../types.ts';
import { SITES, STAGE, REASONING, questView, smellWord } from '../data/story.ts';
import { esc, factsHtml, basisTag } from './cards.ts';

type Tab = 'records' | 'compare' | 'reason';

export interface NotebookHost {
  records(): Site[];
  stage(): number;
  reasonStep(): number;
  /** 추리 문항에 답했다. 맞으면 true */
  answer(step: number, correct: boolean): void;
  startHearing(): void;
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
    else this.renderReason();
    this.body.scrollTop = 0;
  }

  private renderRecords() {
    const recs = this.host.records();
    const blanks = SITES.length - recs.length;
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
      : [['브로드 가 펌프 물을 마신 곳', s => s.drankBroad], ['그 물을 마시지 않은 곳', s => !s.drankBroad]];
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
        <button data-by="water" aria-pressed="${this.groupBy === 'water'}">마신 물로 묶기</button>
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
        <thead><tr><th>조사한 곳</th><th>사망</th><th>백 명에</th><th>악취</th><th>브로드 가 펌프 물</th></tr></thead>
        <tbody>${[...recs].sort((a, b) => b.deaths / b.people - a.deaths / a.people).map(s => `
          <tr>
            <td>${esc(s.name)}</td>
            <td class="num">${s.deaths} / ${s.people}</td>
            <td class="num"><b>${(s.deaths / s.people * 100).toFixed(1)}</b></td>
            <td>${smellWord(s.smell)}</td>
            <td><i class="mark${s.drankBroad ? ' on' : ''}"></i>${s.drankBroad ? '마심' : '안 마심'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    this.body.querySelectorAll<HTMLButtonElement>('.seg button').forEach(b => b.addEventListener('click', () => {
      this.groupBy = b.dataset.by as 'smell' | 'water';
      this.renderCompare();
    }));
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
    } else if (stage === STAGE.REASON) {
      const step = this.host.reasonStep();
      const item = REASONING[step];
      this.body.innerHTML = `
        <p class="sub">추리 ${step + 1} / ${REASONING.length} · 헷갈리면 비교 쪽에서 기록을 묶어 보라.</p>
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
        <p class="sub">세운 가설</p>
        <h3>콜레라는 브로드 가 펌프의 물로 퍼진다</h3>
        <p>가설이 옳다면 이런 사람들이 있어야 한다. 찾아가 확인하라.</p>${checklist}`;
    } else if (stage === STAGE.HEARING) {
      this.body.innerHTML = `
        <p class="sub">9월 7일 목요일 저녁</p>
        <h3>세인트 제임스 교구 위원회에 보고한다</h3>
        <p>위원들이 반박할 때마다 알맞은 기록 한 장을 내놓아야 한다. 기록 쪽을 한 번 더 훑어보고 가도 좋다.</p>
        <div class="actions"><button id="go-hearing" class="btn primary">위원회에 들어간다</button></div>`;
      document.getElementById('go-hearing')!.addEventListener('click', () => { this.close(); this.host.startHearing(); });
    } else {
      this.body.innerHTML = `
        <p class="sub">조사의 결론</p>
        <h3>콜레라는 브로드 가 펌프의 물로 퍼졌다</h3>
        <ul class="steps">
          <li class="done">악취가 심해도 거의 죽지 않은 곳이 있었다</li>
          <li class="done">펌프 곁에 살아도 그 물을 마시지 않은 사람은 무사했다</li>
          <li class="done">멀리 살아도 그 물을 마신 사람은 죽었다</li>
        </ul>
        <p>${stage === STAGE.HANDLE ? '위원회가 손잡이를 떼기로 했다. 브로드 가 펌프로 가라.' : '손잡이는 떼어졌다. 남은 집도 마저 조사해 지도를 완성할 수 있다.'}</p>`;
    }
  }

  /** 열려 있는 쪽을 다시 그린다 (기록이 바뀌었을 때) */
  public refresh() { if (this.isOpen) this.show(this.tab); }
}
