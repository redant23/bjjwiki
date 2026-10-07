import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Combo from '@/models/Combo';
import { gearTypeFromComboName, type ComboGearType } from '@/lib/combo-type';

// gearType이 없는 기존 콤보에 이름 말머리([기]/[노기]/[기/노기]→gi)로 gearType을 채운다.
// 이름은 바꾸지 않는다. 말머리가 없어 판단할 수 없는 콤보는 건드리지 않고 목록으로 보고한다.
// POST /api/admin/migrate-combo-gear?dryRun=1 → 변경 내용만 보고하고 DB는 수정하지 않는다.
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
    await dbConnect();

    const targets = await Combo.collection
      .find({ gearType: { $exists: false } }, { projection: { name: 1 } })
      .toArray();

    const byGear: Record<ComboGearType, string[]> = { gi: [], nogi: [] };
    const unresolved: Array<{ _id: string; name: string }> = [];
    for (const doc of targets) {
      const gear = gearTypeFromComboName(String(doc.name ?? ''));
      if (gear) byGear[gear].push(String(doc._id));
      else unresolved.push({ _id: String(doc._id), name: String(doc.name ?? '') });
    }

    if (!dryRun) {
      for (const gear of ['gi', 'nogi'] as const) {
        if (byGear[gear].length === 0) continue;
        // updatedAt은 건드리지 않는다.
        await Combo.updateMany(
          { _id: { $in: byGear[gear] }, gearType: { $exists: false } },
          { $set: { gearType: gear } },
          { timestamps: false }
        );
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      data: {
        scanned: targets.length,
        gi: byGear.gi.length,
        nogi: byGear.nogi.length,
        unresolved,
      },
    });
  } catch (error) {
    console.error('migrate-combo-gear failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to migrate combo gearType' },
      { status: 500 }
    );
  }
}
