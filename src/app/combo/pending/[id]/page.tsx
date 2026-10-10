import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { findComboByParam, canViewCombo, isComboPublished, viewerFromSession } from '@/lib/combo-service';
import { isObjectIdString } from '@/lib/combo-chain';
import { ComboDetail } from '@/components/combo/ComboDetail';

export const dynamic = 'force-dynamic';

// 대기/반려 콤보 전용 주소. 작성자와 관리자만 열 수 있고, 승인되면 번호 주소로 이동한다.
export default async function PendingComboPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!isObjectIdString(id)) notFound();

  await dbConnect();
  const viewer = viewerFromSession(await getServerSession(authOptions));
  const combo = await findComboByParam(id);
  if (!combo || !canViewCombo(combo, viewer)) notFound();

  if (isComboPublished(combo)) redirect(`/combo/${combo.number ?? combo._id}`);
  return <ComboDetail comboKey={id} />;
}
