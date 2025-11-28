import { redirect } from 'next/navigation';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';

export default async function TechniquePage() {
  await dbConnect();

  // Find the first technique based on order and name
  const firstTechnique = await Technique.findOne({
    status: 'published',
    level: 1 // Prefer top-level technique
  }).sort({ order: 1, 'name.ko': 1 });

  if (firstTechnique) {
    redirect(`/technique/${firstTechnique.slug}`);
  }

  // If no techniques found, go home
  redirect('/');
}
