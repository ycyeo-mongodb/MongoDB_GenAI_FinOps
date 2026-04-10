import { NextRequest, NextResponse } from 'next/server';

const BEDROCK_API_URL = process.env.BEDROCK_API_URL;

if (!BEDROCK_API_URL) {
  console.error('BEDROCK_API_URL environment variable is not set');
}

export async function POST(request: NextRequest) {
  if (!BEDROCK_API_URL) {
    return NextResponse.json(
      { success: false, error: 'BEDROCK_API_URL is not configured. Set it in .env.local' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const response = await fetch(BEDROCK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'extract',
        ...body,
      }),
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error calling Bedrock API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to call extraction API' },
      { status: 500 }
    );
  }
}

