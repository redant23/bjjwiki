'use client';

import { useState } from 'react';
import type { AdminUserRow } from '@/lib/admin-stats';

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

export function StatsUsersTable({ users }: { users: AdminUserRow[] }) {
  const [mask, setMask] = useState(true);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex justify-end border-b px-4 py-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
          이메일 마스킹
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">이메일</th>
              <th className="px-4 py-2 font-medium">가입일</th>
              <th className="px-4 py-2 font-medium">방식</th>
              <th className="px-4 py-2 font-medium">role</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-1.5">{u.nickname}</td>
                <td className="px-4 py-1.5">{mask ? maskEmail(u.email) : u.email}</td>
                <td className="whitespace-nowrap px-4 py-1.5 tabular-nums">
                  {new Date(u.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                </td>
                <td className="px-4 py-1.5">{u.method}</td>
                <td className="px-4 py-1.5">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
