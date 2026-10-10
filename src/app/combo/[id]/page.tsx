import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { findComboByParam, canViewCombo, isComboPublished, viewerFromSession } from '@/lib/combo-service';
import { ComboDetail } from '@/components/combo/ComboDetail';

export const dynamic = 'force-dynamic';

// /combo/<번호>: 공개 주소. 옛 주소(/combo/<ObjectId>)는 번호 주소로 보낸다.
// 대기 중인 콤보는 작성자·관리자에게만 존재하고, 그 외에는 404다(주소 추측으로 존재를 알 수 없다).
export default async function ComboPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  await dbConnect();
  const viewer = viewerFromSession(await getServerSession(authOptions));

  const combo = await findComboByParam(id);
  if (!combo || !canViewCombo(combo, viewer)) notFound();

  if (!isComboPublished(combo)) redirect(`/combo/pending/${combo._id}`);
  if (typeof combo.number === 'number' && id !== String(combo.number)) {
    redirect(`/combo/${combo.number}`);
  }

  return <ComboDetail comboKey={id} />;
}
