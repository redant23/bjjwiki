// 테스트용: 같은 클러스터의 다른 DB 로 필요한 컬렉션을 복제한다 (원본은 읽기만 한다).
// 사용: node scripts/combo-v2/clone-db.ts --to=bjjwiki_test
import { arg, connect } from './env.ts';

const to = arg('to');
if (!to) throw new Error('--to=대상DB 가 필요합니다');
const { client, db } = await connect();
if (to === db.databaseName) throw new Error('원본과 같은 DB 입니다');
const target = client.db(to);
await target.dropDatabase();

for (const name of ['users', 'techniques', 'combos', 'notifications', 'techniquerequests', 'announcements']) {
  const docs = await db.collection(name).find().toArray();
  if (docs.length) await target.collection(name).insertMany(docs);
  console.log(`${name}: ${docs.length}`);
}
await client.close();
