import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';

const INITIAL_TECHNIQUES = [
  {
    name: 'Armbar',
    category: 'Submission',
    description: 'A joint lock that hyperextends the elbow joint.',
    status: 'approved',
    is_current_version: true,
  },
  {
    name: 'Triangle Choke',
    category: 'Submission',
    description: 'A chokehold done with the legs.',
    status: 'approved',
    is_current_version: true,
  },
  {
    name: 'Double Leg Takedown',
    category: 'Takedown',
    description: 'A takedown involving grabbing both of the opponent\'s legs.',
    status: 'approved',
    is_current_version: true,
  },
  {
    name: 'Closed Guard',
    category: 'Guard',
    description: 'A guard where the legs are wrapped around the opponent\'s back.',
    status: 'approved',
    is_current_version: true,
  },
  {
    name: 'Scissor Sweep',
    category: 'Sweep',
    description: 'A sweep using a scissor motion of the legs.',
    status: 'approved',
    is_current_version: true,
  },
];

export async function GET() {
  try {
    await dbConnect();

    // Check if data exists
    const count = await Technique.countDocuments();
    if (count > 0) {
      return NextResponse.json({ message: 'Database already seeded' });
    }

    await Technique.insertMany(INITIAL_TECHNIQUES);

    return NextResponse.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to seed database' },
      { status: 500 }
    );
  }
}
