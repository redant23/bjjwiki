import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import cloudinary from '@/lib/cloudinary';
import dbConnect from '@/lib/db';
import ImageModel from '@/models/Image';
import { authOptions, requireAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const usage = formData.get('usage') as string;

    let uploaderType: 'admin' | 'user';

    if (usage === 'combo_photo') {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      uploaderType = session.user.role === 'admin' ? 'admin' : 'user';
    } else {
      const { session, error: authError } = await requireAdmin();
      if (authError) return authError;
      uploaderType = session!.user.role;
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    await dbConnect();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const uploadResult: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'bjjwiki' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    // Save to DB
    const newImage = await ImageModel.create({
      uploaderType,
      usage: usage || 'technique_thumbnail',
      url: uploadResult.secure_url,
      alt: file.name,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: newImage.url,
        imageId: newImage._id,
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
