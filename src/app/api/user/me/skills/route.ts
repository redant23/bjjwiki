import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    const user = await User.findById(session.user.id)
      .select('mySkills')
      .populate('mySkills.technique', 'name slug pathSlugs');

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // A tagged technique may have been deleted since; populate() resolves
    // that entry's `technique` to null, which downstream UI can't render.
    const skills = user.mySkills.filter((skill) => skill.technique);

    return NextResponse.json({ success: true, data: skills });
  } catch (error) {
    console.error('GET /api/user/me/skills error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch skills' },
      { status: 500 }
    );
  }
}
