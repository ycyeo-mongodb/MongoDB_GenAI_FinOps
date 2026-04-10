import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';

export async function POST() {
  try {
    await dbConnect();
    
    // Clear all embeddings to allow re-embedding with new provider
    const result = await FinancialReconciliation.updateMany(
      {},
      { $unset: { embedding: "", embedding_text: "" } }
    );
    
    return NextResponse.json({
      success: true,
      message: `Cleared embeddings from ${result.modifiedCount} documents`,
    });
  } catch (error) {
    console.error('Clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear embeddings' },
      { status: 500 }
    );
  }
}

