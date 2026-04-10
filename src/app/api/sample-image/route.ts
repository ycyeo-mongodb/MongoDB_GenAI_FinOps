import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageName = searchParams.get('name');

    if (!imageName) {
      return NextResponse.json({ error: 'Image name required' }, { status: 400 });
    }

    // Validate image name to prevent directory traversal
    const allowedImages = ['test.png', 'excel-invoice-template.png'];
    if (!allowedImages.includes(imageName)) {
      return NextResponse.json({ error: 'Invalid image name' }, { status: 400 });
    }

    const imagePath = join(process.cwd(), 'testimages', imageName);
    const imageBuffer = readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');

    const mediaType = imageName.endsWith('.png') ? 'image/png' : 'image/jpeg';

    return NextResponse.json({
      success: true,
      image_base64: base64,
      media_type: mediaType,
    });
  } catch (error) {
    console.error('Error loading sample image:', error);
    return NextResponse.json(
      { error: 'Failed to load sample image' },
      { status: 500 }
    );
  }
}

