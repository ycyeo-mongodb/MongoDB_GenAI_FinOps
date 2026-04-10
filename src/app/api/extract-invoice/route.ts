import { NextRequest, NextResponse } from 'next/server';

const BEDROCK_API_URL = process.env.BEDROCK_API_URL || 'https://kllxjgmeg3.execute-api.us-east-1.amazonaws.com/finance_demo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward request to Bedrock API with extract action
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

