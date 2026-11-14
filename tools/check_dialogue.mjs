// 대사 점검: 주민이 말하는 숫자가 기록과 맞는지, 기록에 없는 성별·관계를 지어내지 않았는지.
//   node tools/check_dialogue.mjs            (문제가 있으면 줄마다 적고 끝 코드 1)
//   node tools/check_dialogue.mjs 파일.txt   (모든 대사를 파일로도 뽑는다)
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';

const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { SITES } = await s.ssrLoadModule('/src/data/story.ts');
await s.close();

const KOR = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
// 기록에는 누가 죽었는지가 없으므로, 구역 주민은 이런 말을 쓰지 않는다
const GENDERED = /아내|남편|시어머니|시아버지|장모|장인|아들|딸[이을은과]|며느리|사위|부인|그녀/;
const bad = [], dump = [];
for (const x of SITES) {
  const lines = [...x.intro, ...x.toll, ...x.air, ...x.water, x.outro];
  dump.push(`## ${x.id} ${x.name} · ${x.npc.role} ${x.npc.name} · 사망 ${x.deaths}/${x.people} · ${x.waterShort}`, ...lines, '');
  if (!/^d\d/.test(x.id)) continue;               // 이야기 집은 손으로 쓴 대사 (따로 본다)
  // 날짜(9월 1일)·층(2층)과 직업 이름(예: '재단사 아내')은 기록과 견줄 숫자·지어낸 관계가 아니다
  const say = lines.filter(l => !l.startsWith('나:')).map(l => l.split(x.npc.role).join('').split(x.name).join('').replace(/\d+월 \d+일|\d+층/g, ''));
  const err = m => bad.push(`${x.id} ${x.name}: ${m}`);
  // 1) 숫자: 아라비아 숫자는 식구 수와 사망자 수만
  for (const l of say) for (const n of l.match(/\d+/g) ?? []) if (+n !== x.people && +n !== x.deaths) err(`기록에 없는 숫자 ${n}: ${l}`);
  // 2) 앓은 사람: 식구 수와 사망자 수를 말하고, 누가 죽었는지 말하는 줄의 수가 사망자 수와 같다
  const count = x.toll[1];
  if (!count.includes(`${x.people}명`)) err(`식구 수가 빠짐: ${count}`);
  if (x.deaths > 0 && !count.includes(`${x.deaths}명`)) err(`사망자 수가 빠짐: ${count}`);
  if (x.deaths > 0) {
    const who = x.toll[2];
    const want = x.deaths === 1 ? /한 사람|하나/ : new RegExp(x.deaths <= 10 ? `${KOR[x.deaths]}[이을]` : `${x.deaths}명`);
    if (!want.test(who)) err(`사망자 수와 다른 말: ${who}`);
    for (const k of KOR.slice(2)) if (k !== KOR[x.deaths] && new RegExp(`(^|\s)${k}[이을]`).test(who)) err(`다른 수: ${who}`);
  }
  // 3) 성별·관계를 지어내지 않는다
  for (const l of say) if (GENDERED.test(l)) err(`성별·관계를 지어냄: ${l}`);
  // 4) 채우지 못한 자리표
  for (const l of lines) if (/[{}]|undefined/.test(l)) err(`자리표: ${l}`);
}
if (process.argv[2]) writeFileSync(process.argv[2], dump.join('\n'));
console.log(bad.length ? bad.join('\n') + `\n문제 ${bad.length}건` : `구역 주민 ${SITES.filter(x => /^d\d/.test(x.id)).length}명 대사 점검 통과`);
process.exit(bad.length ? 1 : 0);
