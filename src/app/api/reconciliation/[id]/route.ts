import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const reconciliation = await FinancialReconciliation.findById(id).lean();

    if (!reconciliation) {
      return NextResponse.json(
        { error: 'Reconciliation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(reconciliation);
  } catch (error) {
    console.error('Detail API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation details' },
      { status: 500 }
    );
  }
}

