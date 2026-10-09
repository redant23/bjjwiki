import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAdminUsers } from '@/lib/admin-stats';

export const dynamic = 'force-dynamic';

// 가입자 목록. passwordHash 등 민감 필드는 getAdminUsers에서 select 단계부터 제외한다.
export async function GET(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const params = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(parseInt(params.get('limit') ?? '20', 10) || 20, 1), 100);
    const page = Math.max(parseInt(params.get('page') ?? '1', 10) || 1, 1);

    const data = await getAdminUsers(limit, page);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load users' }, { status: 500 });
  }
}
