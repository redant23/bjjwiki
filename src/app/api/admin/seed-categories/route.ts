import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Technique from '@/models/Technique';
import { CATEGORY_DESCRIPTIONS } from '@/lib/categoryData';

function generateSlug(name: string): string {
  // Extract English name from "Korean (English)"
  const match = name.match(/\(([^)]+)\)/);
  if (match) {
    return match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  // Fallback to Korean romanization or just random? 
  // For now, let's assume all categories have English names in parens as per categoryData.ts
  return 'unknown-' + Math.random().toString(36).substring(7);
}

export async function GET() {
  try {
    await dbConnect();

    const results = [];

    // Sort keys to ensure parents are processed before children
    const keys = Object.keys(CATEGORY_DESCRIPTIONS).sort();

    for (const key of keys) {
      const parts = key.split('::');
      const data = CATEGORY_DESCRIPTIONS[key];
      const depth = parts.length;

      const nameKo = data.name.split(' (')[0];
      const nameEn = data.name.match(/\(([^)]+)\)/)?.[1] || '';
      const slug = generateSlug(data.name);

      let parentId = null;
      let pathSlugs: string[] = [];

      if (depth > 1) {
        // Find parent
        const parentKey = parts.slice(0, -1).join('::');
        const parentData = CATEGORY_DESCRIPTIONS[parentKey];
        if (parentData) {
          const parentSlug = generateSlug(parentData.name);
          const parent = await Technique.findOne({ slug: parentSlug });
          if (parent) {
            parentId = parent._id;
            pathSlugs = [...parent.pathSlugs, parent.slug];
          }
        }
      }

      // Upsert
      const technique = await Technique.findOneAndUpdate(
        { slug },
        {
          name: { ko: nameKo, en: nameEn },
          description: { ko: data.description, en: '' }, // TODO: Add English description if available
          type: 'both', // Default
          primaryRole: depth === 1 ? 'position' : 'drill', // Default, needs refinement
          level: depth,
          parentId,
          pathSlugs,
          status: 'published',
          isCorePosition: depth === 1, // Assume top level are core
        },
        { upsert: true, new: true }
      );

      results.push({ key, slug, id: technique._id });
    }

    // Sync childrenIds after seeding
    // 1. Clear all childrenIds first
    await Technique.updateMany({}, { $set: { childrenIds: [] } });

    // 2. Find all techniques that have a parent
    const children = await Technique.find({ parentId: { $ne: null } }).select('_id parentId');

    // 3. Add each child to its parent's childrenIds
    for (const child of children) {
      if (child.parentId) {
        await Technique.findByIdAndUpdate(child.parentId, {
          $addToSet: { childrenIds: child._id }
        });
      }
    }

    return NextResponse.json({ success: true, results, message: 'Seeding and sync completed' });
  } catch (error) {
    console.error('Seeding failed:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
