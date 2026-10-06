import { redirect } from 'next/navigation';
import { getTechniqueRedirect } from '@/lib/technique-service';
import TechniqueDetailClient from './TechniqueDetailClient';

// 기술은 주소의 마지막 조각(slug)으로 찾기 때문에, 분류를 옮기거나 slug를 바꾼 뒤에도 옛 주소로 들어오면
// 같은 기술이 열린다. 정식 주소가 아니면 여기서 정식 주소로 보내 주소를 하나로 통일한다.
// 분류는 다시 옮길 수 있으므로 브라우저가 영구 캐시하는 308이 아니라 임시 리다이렉트(307)를 쓴다.
export default async function TechniquePage(props: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await props.params;
  const target = await getTechniqueRedirect(slug);
  if (target) redirect(target);

  return <TechniqueDetailClient />;
}
