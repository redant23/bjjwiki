/* eslint-disable @typescript-eslint/no-explicit-any */
// 백업 복원: combos 컬렉션을 백업 시점으로 되돌리고, users.savedCombos/savedComboLog 와 counters 도 되돌린다.
// 사용: node scripts/combo-v2/restore.ts --from=backups/combo-v2-... [--db=이름] --yes
import fs from 'node:fs';
import path from 'node:path';
import { EJSON } from 'bson';
import { arg, connect } from './env.ts';

const from = arg('from');
if (!from) throw new Error('--from=백업폴더 가 필요합니다');
if (arg('yes') !== 'true') throw new Error('되돌리기는 combos 컬렉션을 덮어씁니다. 확인되면 --yes 를 붙이세요.');

const dir = path.resolve(from);
const read = (name: string) => EJSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'), { relaxed: false }) as any[];
const { client, db } = await connect();

const combos = read('combos.json');
const users = read('users-savedCombos.json');
const counters = read('counters.json');

await db.collection('combos').deleteMany({});
// 이전 시 만든 부분 유니크 인덱스(chainKey/number)가 옛 문서와 충돌하지 않도록 먼저 지운다.
for (const name of ['chainKey_1', 'number_1']) {
  await db.collection('combos').dropIndex(name).catch(() => undefined);
}
if (combos.length) await db.collection('combos').insertMany(combos);

for (const u of users) {
  const update = u.savedComboLog
    ? { $set: { savedCombos: u.savedCombos ?? [], savedComboLog: u.savedComboLog } }
    : { $set: { savedCombos: u.savedCombos ?? [] }, $unset: { savedComboLog: 1 } };
  await db.collection('users').updateOne({ _id: u._id }, update);
}

await db.collection('counters').deleteMany({});
if (counters.length) await db.collection('counters').insertMany(counters);
await db.collection('comborequests').deleteMany({}).catch(() => undefined);

console.log(`복원 완료: db=${db.databaseName} combos=${combos.length} users=${users.length}`);
await client.close();
