/** 면담과 위원회에서 쓰는 대화 장면. say/choose 를 await 로 이어 붙여 대본처럼 쓴다. */

export class SceneClosed extends Error {}

export interface Choice { label: string; sub?: string; done?: boolean; disabled?: boolean; leave?: boolean }

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Scene {
  private root = el<HTMLElement>('scene');
  private place = el<HTMLElement>('scene-place');
  private me = el<HTMLImageElement>('scene-me');
  private npc = el<HTMLImageElement>('scene-npc');
  private card = el<HTMLElement>('scene-card');
  private box = this.root.querySelector<HTMLElement>('.scene-box')!;
  private speaker = el<HTMLElement>('scene-speaker');
  private text = el<HTMLElement>('scene-text');
  private choices = el<HTMLElement>('scene-choices');
  private next = el<HTMLElement>('scene-next');

  private myName = '';
  private npcName = '';
  private npcRole = '';
  private typing = 0;
  private full = '';
  private advance: (() => void) | null = null;
  private fail: ((e: Error) => void) | null = null;
  private pick: ((i: number) => void) | null = null;

  constructor() {
    this.box.addEventListener('click', e => {
      if (!(e.target as HTMLElement).closest('.opt')) this.step();
    });
    el('scene-close').addEventListener('click', () => this.close());
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { this.close(); return; }
      if (this.pick) {
        const n = Number(e.key);
        const btn = n >= 1 ? this.choices.querySelectorAll<HTMLButtonElement>('.opt')[n - 1] : null;
        if (btn && !btn.disabled) btn.click();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e') { e.preventDefault(); this.step(); }
    });
  }

  public get isOpen() { return !this.root.classList.contains('hidden'); }

  public open(place: string, myName: string, myPortrait: string) {
    this.place.textContent = place;
    this.myName = myName;
    this.me.src = myPortrait;
    this.text.textContent = '';
    this.speaker.textContent = '';
    this.choices.replaceChildren();
    this.setCard(null);
    this.root.classList.remove('hidden');
  }

  public setNpc(name: string, role: string, portrait: string) {
    this.npcName = name;
    this.npcRole = role;
    this.npc.src = portrait;
  }

  public setCard(html: string | null) {
    this.card.classList.toggle('hidden', html === null);
    if (html !== null) this.card.innerHTML = html;
  }

  /** 장면을 닫는다. 진행 중이던 say/choose 는 SceneClosed 로 끝난다 */
  public close() {
    if (!this.isOpen) return;
    clearInterval(this.typing);
    this.root.classList.add('hidden');
    const fail = this.fail;
    this.advance = this.pick = this.fail = null;
    fail?.(new SceneClosed());
  }

  /** 한 줄씩 보여 주고 넘김 입력을 기다린다 */
  public async say(lines: string[]) {
    for (const line of lines) await this.line(line);
  }

  private line(raw: string): Promise<void> {
    let body = raw, who: 'npc' | 'me' | 'none' = 'npc', name = this.npcName, role = this.npcRole;
    if (raw.startsWith('(')) { who = 'none'; }
    else if (raw.startsWith('나: ')) { who = 'me'; name = this.myName; role = '조사관'; body = raw.slice(3); }
    else if (raw.includes('|')) { [name, body] = raw.split('|'); role = ''; }

    this.speaker.replaceChildren();
    if (who !== 'none') {
      this.speaker.append(name);
      if (role) { const s = document.createElement('small'); s.textContent = role; this.speaker.append(s); }
    }
    this.me.classList.toggle('speaking', who === 'me');
    this.npc.classList.toggle('speaking', who === 'npc');
    this.text.classList.toggle('narration', who === 'none');
    this.choices.replaceChildren();
    this.choices.className = '';
    this.next.classList.add('hidden');

    this.full = body;
    this.text.textContent = '';
    let i = 0;
    clearInterval(this.typing);
    this.typing = window.setInterval(() => {
      i += 2;
      this.text.textContent = body.slice(0, i);
      if (i >= body.length) this.finishTyping();
    }, 28);

    return new Promise((resolve, reject) => { this.advance = resolve; this.fail = reject; });
  }

  private finishTyping() {
    clearInterval(this.typing);
    this.typing = 0;
    this.text.textContent = this.full;
    this.next.classList.remove('hidden');
  }

  private step() {
    if (this.pick) return;
    if (this.typing) { this.finishTyping(); return; }
    const go = this.advance;
    this.advance = null;
    go?.();
  }

  /** 선택지를 보여 주고 고른 번호를 돌려준다 */
  public choose(prompt: string, options: Choice[], grid = false): Promise<number> {
    clearInterval(this.typing);
    this.typing = 0;
    this.speaker.replaceChildren();
    this.me.classList.add('speaking');
    this.npc.classList.remove('speaking');
    this.text.classList.remove('narration');
    this.text.textContent = prompt;
    this.next.classList.add('hidden');
    this.choices.className = grid ? 'grid' : '';
    this.choices.replaceChildren(...options.map((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt' + (o.done ? ' done' : '') + (o.leave ? ' leave' : '');
      b.disabled = !!o.disabled;
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = o.done ? '✓' : String(i + 1);
      const label = document.createElement('span');
      label.textContent = o.label;
      if (o.sub) { const s = document.createElement('small'); s.textContent = o.sub; label.append(s); }
      b.append(num, label);
      b.addEventListener('click', () => {
        const pick = this.pick;
        this.pick = null;
        this.choices.replaceChildren();
        pick?.(i);
      });
      return b;
    }));
    return new Promise((resolve, reject) => { this.pick = resolve; this.fail = reject; });
  }
}
