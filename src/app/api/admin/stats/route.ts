import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAdminStats } from '@/lib/admin-stats';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const data = await getAdminStats();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load stats' }, { status: 500 });
  }
}
