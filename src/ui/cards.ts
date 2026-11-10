import { Site, QuestionId } from '../types.ts';
import { smellWord } from '../data/story.ts';

export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const FACT: Record<QuestionId, { label: string; value: (s: Site) => string }> = {
  toll: { label: '사망', value: s => `${s.people}명 가운데 <b>${s.deaths}</b>명` },
  air: { label: '공기', value: s => `악취 ${smellWord(s.smell)} · ${esc(s.smellNote)}` },
  water: { label: '마시는 물', value: s => esc(s.waterNote) },
};
export const QUESTIONS: QuestionId[] = ['toll', 'air', 'water'];

/** 조사 기록 세 줄. asked 에 없는 항목은 빈칸으로 둔다. fresh 는 방금 채운 항목(도장 연출) */
export function factsHtml(s: Site, asked?: QuestionId[], fresh?: QuestionId): string {
  const rows = QUESTIONS.map(q => {
    const known = !asked || asked.includes(q);
    const cls = known ? (q === fresh ? ' class="stamp"' : '') : ' class="empty"';
    return `<dt>${FACT[q].label}</dt><dd${cls}>${known ? FACT[q].value(s) : '· · ·'}</dd>`;
  });
  return `<dl class="facts">${rows.join('')}</dl>`;
}

export function basisTag(s: Site): string {
  return `<span class="tag">${s.basis === 'record' ? '스노우의 보고서에 실린 사례' : '당시 기록으로 꾸민 가구'}</span>`;
}
