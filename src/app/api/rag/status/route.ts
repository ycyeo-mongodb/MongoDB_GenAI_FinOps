import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';

export async function GET() {
  try {
    await dbConnect();
    
    const total = await FinancialReconciliation.countDocuments();
    const embedded = await FinancialReconciliation.countDocuments({ 
      embedding: { $ne: null, $exists: true, $not: { $size: 0 } } 
    });
    
    // Get a sample embedded document
    const sample = await FinancialReconciliation.findOne({ 
      embedding: { $ne: null } 
    }).select('invoice_data.invoice_id embedding_text').lean();
    
    return NextResponse.json({
      total,
      embedded,
      percentage: total > 0 ? Math.round((embedded / total) * 100) : 0,
      sample: sample ? {
        invoice_id: sample.invoice_data?.invoice_id,
        embedding_text: sample.embedding_text?.substring(0, 200) + '...',
      } : null,
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

