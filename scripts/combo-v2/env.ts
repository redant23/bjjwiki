// 마이그레이션 스크립트 공통: .env.local 로드, DB 연결, 인자 파싱. 비밀 값은 출력하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, type Db } from 'mongodb';

export function loadEnv(file = '.env.local') {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) {
      const key = line.slice(0, i).trim();
      if (!(key in process.env)) process.env[key] = line.slice(i + 1).trim();
    }
  }
}

export function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : 'true';
}

/** --db=이름 으로 같은 클러스터의 다른 DB(예: 복제본)를 지정한다. 없으면 URI 기본 DB. */
export async function connect(): Promise<{ client: MongoClient; db: Db }> {
  loadEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI 가 없습니다 (.env.local)');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(arg('db'));
  return { client, db };
}
