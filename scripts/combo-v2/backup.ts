// 콤보 v2 이전 전 백업: combos 전체, users 의 savedCombos, counters 를 JSON(EJSON)으로 저장한다.
// 사용: node scripts/combo-v2/backup.ts [--db=이름]
import fs from 'node:fs';
import path from 'node:path';
import { EJSON } from 'bson';
import { connect } from './env.ts';

const { client, db } = await connect();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.resolve('backups', `combo-v2-${db.databaseName}-${stamp}`);
fs.mkdirSync(dir, { recursive: true });

const combos = await db.collection('combos').find().toArray();
const users = await db
  .collection('users')
  .find({}, { projection: { savedCombos: 1, savedComboLog: 1 } })
  .toArray();
const counters = await db.collection('counters').find().toArray();
const indexes = await db.collection('combos').indexes();

fs.writeFileSync(path.join(dir, 'combos.json'), EJSON.stringify(combos, undefined, 2, { relaxed: false }));
fs.writeFileSync(path.join(dir, 'users-savedCombos.json'), EJSON.stringify(users, undefined, 2, { relaxed: false }));
fs.writeFileSync(path.join(dir, 'counters.json'), EJSON.stringify(counters, undefined, 2, { relaxed: false }));
fs.writeFileSync(path.join(dir, 'combo-indexes.json'), JSON.stringify(indexes, null, 2));
fs.writeFileSync(
  path.join(dir, 'meta.json'),
  JSON.stringify({ db: db.databaseName, takenAt: new Date().toISOString(), combos: combos.length, users: users.length }, null, 2)
);

console.log(`백업 완료: ${dir}`);
console.log(`  db=${db.databaseName} combos=${combos.length} users=${users.length} counters=${counters.length}`);
await client.close();
