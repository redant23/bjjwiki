'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlertTriangle } from 'lucide-react';

interface SimilarTechnique {
  _id: string;
  name: string;
  href: string;
  reason: 'same_name' | 'alias' | 'similar';
  matched: string;
}

interface SimilarTechniqueWarningProps {
  name: { ko?: string; en?: string };
  aka?: { ko?: string[]; en?: string[] };
  // 수정 중인 기술 자신은 제외한다.
  excludeId?: string;
}

const REASON_LABELS: Record<SimilarTechnique['reason'], string> = {
  same_name: '같은 이름',
  alias: '별칭이 겹침',
  similar: '비슷한 이름',
};

// 관리자에게만 보이는 중복/유사 기술 안내. 저장을 막지 않고, 일반 계정에는 아무것도 렌더링하지 않는다.
export function SimilarTechniqueWarning({ name, aka, excludeId }: SimilarTechniqueWarningProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const [matches, setMatches] = useState<SimilarTechnique[]>([]);

  const ko = name.ko ?? '';
  const en = name.en ?? '';
  const akaKey = JSON.stringify([aka?.ko ?? [], aka?.en ?? []]);

  // 이름이 너무 짧거나 관리자가 아니면 조회하지 않고, 이전 결과도 보여주지 않는다.
  const eligible = isAdmin && (ko.trim().length >= 2 || en.trim().length >= 2);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const [akaKo, akaEn] = JSON.parse(akaKey);
        const res = await fetch('/api/admin/similar-techniques', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: { ko, en }, aka: { ko: akaKo, en: akaEn }, excludeId }),
        });
        const data = await res.json();
        if (!cancelled) setMatches(data.success ? data.data : []);
      } catch {
        // 경고는 부가 기능이므로 실패해도 조용히 넘어간다.
        if (!cancelled) setMatches([]);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [eligible, ko, en, akaKey, excludeId]);

  if (!eligible || matches.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="mb-1 flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-4 w-4" />
        비슷한 기술이 이미 있습니다
      </div>
      <p className="mb-2 text-xs">중복이 아닌지 확인해 주세요. (관리자에게만 보이며 저장은 막지 않습니다)</p>
      <ul className="space-y-1">
        {matches.map((m) => (
          <li key={m._id}>
            <a
              href={m.href}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2"
            >
              {m.name}
            </a>
            <span className="ml-2 text-xs">
              {REASON_LABELS[m.reason]}
              {m.reason !== 'same_name' && ` (${m.matched})`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
