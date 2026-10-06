import Link from 'next/link';
import { ArrowRight, Video } from 'lucide-react';
import type { HomeCategory, HomeCombo, HomeData, HomeTechniqueCard } from '@/lib/home-service';
import { ROLE_LABELS } from '@/lib/technique-request-format';
import { CardThumb, TechniqueCard } from '@/components/technique/TechniqueCard';
import { categoryIconKey } from '@/lib/technique-cards';
import { CATEGORY_ICONS } from '@/components/technique/category-icons';

function SectionTitle({ children, href, linkLabel }: { children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-2xl font-semibold">{children}</h2>
      {href && (
        <Link href={href} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          {linkLabel}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function TodayCard({ card }: { card: HomeTechniqueCard }) {
  return (
    <Link
      href={card.href}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50 hover:shadow-md sm:flex-row"
    >
      <CardThumb card={card} className="aspect-video w-full shrink-0 sm:aspect-auto sm:h-auto sm:w-64" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{ROLE_LABELS[card.primaryRole] || card.primaryRole}</span>
          {card.hasVideo && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Video className="h-3.5 w-3.5" />
              영상
            </span>
          )}
        </div>
        <div className="text-2xl font-bold">{card.name}</div>
        {card.summary && <p className="line-clamp-3 text-muted-foreground">{card.summary}</p>}
      </div>
    </Link>
  );
}

function CategoryLink({ category }: { category: HomeCategory }) {
  const Icon = CATEGORY_ICONS[categoryIconKey(category.name)];
  return (
    <Link
      href={category.href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:bg-accent"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold">{category.name}</div>
        <div className="text-xs text-muted-foreground">{category.count}개 기술</div>
      </div>
    </Link>
  );
}

function ComboLink({ combo }: { combo: HomeCombo }) {
  return (
    <Link
      href={`/combo/${combo._id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-accent"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{combo.name}</span>
        {combo.saveCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">저장 {combo.saveCount}</span>}
      </div>
      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{combo.chain.join(' → ')}</p>
    </Link>
  );
}

// 홈 히어로 아래 섹션들. 내용이 없는 섹션은 통째로 숨긴다.
export function HomeSections({ data }: { data: HomeData }) {
  return (
    <div className="space-y-12 py-12 md:py-16">
      {data.today && (
        <section>
          <SectionTitle>오늘의 기술</SectionTitle>
          <TodayCard card={data.today} />
        </section>
      )}

      {data.recent.length > 0 && (
        <section>
          <SectionTitle>최근 추가</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {data.recent.map((card) => (
              <TechniqueCard key={card._id} card={card} />
            ))}
          </div>
        </section>
      )}

      {data.categories.length > 0 && (
        <section>
          <SectionTitle>카테고리 바로가기</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {data.categories.map((category) => (
              <CategoryLink key={category._id} category={category} />
            ))}
          </div>
        </section>
      )}

      {data.combos.length > 0 && (
        <section>
          <SectionTitle href="/combo" linkLabel="콤보 전체 보기">
            인기 콤보
          </SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.combos.map((combo) => (
              <ComboLink key={combo._id} combo={combo} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
