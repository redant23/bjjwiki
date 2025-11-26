import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';
import dbConnect from '@/lib/db';
import ImageModel from '@/models/Image';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const usage = formData.get('usage') as string;
    const uploaderType = 'user'; // TODO: Get from session when auth is implemented

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

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
