/* eslint-disable @typescript-eslint/no-explicit-any */
// 콤보 v2 이전: 번호(createdAt 순), chainKey, status, publishedAt, demos[0] 생성, 카운터, 인덱스.
// 추가형·재실행 가능: 이미 번호가 있는 문서는 건드리지 않고, name/gearType/videoUrl 은 그대로 둔다.
// 사용:
//   node scripts/combo-v2/migrate.ts [--db=이름]            # 드라이런(기본): 대응표만 출력, DB 변경 없음
//   node scripts/combo-v2/migrate.ts [--db=이름] --apply    # 실제 적용
import mongodb from 'mongodb';
const { ObjectId } = mongodb;
import { buildChainKey, demoVideoKey } from '../../src/lib/combo-chain.ts';
import { getYoutubeStartSeconds, getYoutubeVideoId } from '../../src/lib/youtube.ts';
import { arg, connect } from './env.ts';

const apply = arg('apply') === 'true';
const { client, db } = await connect();
const combos = db.collection('combos');
const counters = db.collection('counters');

const all = await combos.find().sort({ createdAt: 1, _id: 1 }).toArray();
console.log(`대상 DB: ${db.databaseName} · ${apply ? '적용 모드' : '드라이런'} · 전체 콤보 ${all.length}개`);

// 이미 번호가 있는 문서는 건너뛴다(재실행/배포 후 신규분 보정).
const todo = all.filter((c) => typeof c.number !== 'number');
const existingMax = all.reduce((m, c) => (typeof c.number === 'number' ? Math.max(m, c.number) : m), 0);
const counterDoc = await counters.findOne({ _id: 'combo' as any });
const startAfter = Math.max(existingMax, counterDoc?.seq ?? 0);

// chainKey 유일성 사전 검사 (기존 활성 문서 포함)
const seen = new Map<string, string>();
const dupes: string[] = [];
for (const c of all) {
  const key = buildChainKey((c.techniques ?? []).map(String));
  if (c.status === 'rejected') continue;
  if (seen.has(key)) dupes.push(`${seen.get(key)} == ${c._id}`);
  else seen.set(key, String(c._id));
}
if (dupes.length) {
  console.error('중복 기술 순서가 있어 중단합니다:\n' + dupes.join('\n'));
  process.exit(1);
}

const rows: Array<Record<string, unknown>> = [];
const plans: Array<{ _id: ObjectId; set: Record<string, unknown> }> = [];
let next = startAfter;
let withDemo = 0;
let withStart = 0;
const badVideo: string[] = [];

for (const c of todo) {
  next += 1;
  const set: Record<string, unknown> = {
    number: next,
    chainKey: buildChainKey((c.techniques ?? []).map(String)),
    status: c.status ?? 'published',
    publishedAt: c.publishedAt ?? c.createdAt ?? new Date(),
  };
  const url = typeof c.videoUrl === 'string' ? c.videoUrl.trim() : '';
  if (!c.demos || c.demos.length === 0) {
    if (url) {
      if (!getYoutubeVideoId(url)) badVideo.push(`#${next} ${url}`);
      if (getYoutubeStartSeconds(url)) withStart += 1;
      set.demos = [
        {
          _id: new ObjectId(),
          videoUrl: url,
          gearType: c.gearType === 'gi' || c.gearType === 'nogi' ? c.gearType : 'unknown',
          videoKey: demoVideoKey(url) ?? undefined,
          createdBy: c.createdBy,
          createdAt: c.createdAt ?? new Date(),
        },
      ];
      withDemo += 1;
    } else {
      set.demos = [];
    }
  }
  plans.push({ _id: c._id, set });
  rows.push({
    번호: next,
    _id: String(c._id),
    기술수: (c.techniques ?? []).length,
    gearType: c.gearType ?? '-',
    영상: url ? (getYoutubeStartSeconds(url) ? `있음(t=${getYoutubeStartSeconds(url)})` : '있음') : '없음',
    chainKey: String(set.chainKey),
  });
}

console.table(rows);
console.log(
  `이전 대상 ${todo.length}개 · 시연(demos[0]) 생성 ${withDemo}개 · 시작 시간(t=) 보존 ${withStart}개 · 영상 없음 ${todo.length - withDemo}개`
);
if (badVideo.length) console.warn('유튜브로 해석되지 않는 영상 링크(원문 보존):\n' + badVideo.join('\n'));
console.log(`카운터: 현재 ${counterDoc?.seq ?? '(없음)'} → ${Math.max(next, counterDoc?.seq ?? 0)}`);

if (!apply) {
  console.log('\n드라이런이라 DB를 바꾸지 않았습니다. 적용하려면 --apply 를 붙이세요.');
  await client.close();
  process.exit(0);
}

for (const plan of plans) {
  await combos.updateOne({ _id: plan._id, number: { $exists: false } }, { $set: plan.set });
}
// 카운터는 올리기만 한다(이미 더 크면 유지).
await counters.updateOne({ _id: 'combo' as any }, { $max: { seq: next } }, { upsert: true });

// 인덱스: 번호(부분 유니크), chainKey(pending+published 부분 유니크). 서버가 partial $in 을 지원해야 한다.
await combos.createIndex({ number: 1 }, { unique: true, partialFilterExpression: { number: { $type: 'number' } }, name: 'number_1' });
await combos.createIndex(
  { chainKey: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'published'] } }, name: 'chainKey_1' }
);
await combos.createIndex({ status: 1, publishedAt: -1 });

const after = await combos.countDocuments();
const numbered = await combos.countDocuments({ number: { $type: 'number' } });
const distinctKeys = (await combos.distinct('chainKey')).length;
console.log(`\n적용 완료: 콤보 ${after}개 · 번호 부여 ${numbered}개 · chainKey 종류 ${distinctKeys}개`);
await client.close();
