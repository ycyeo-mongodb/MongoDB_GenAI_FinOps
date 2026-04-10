import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';

export async function GET() {
  try {
    await connectDB();

    // Always use all-time stats for the demo
    const statsAllTime = await FinancialReconciliation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Transform aggregation results
    const byStatus: Record<string, number> = {};
    statsAllTime.forEach((item: { _id: string; count: number }) => {
      byStatus[item._id] = item.count;
    });

    const total =
      (byStatus['MATCHED'] || 0) +
      (byStatus['FLAGGED_FOR_REVIEW'] || 0) +
      (byStatus['PENDING'] || 0);

    const total_matched = byStatus['MATCHED'] || 0;
    const total_flagged = byStatus['FLAGGED_FOR_REVIEW'] || 0;
    const total_pending = byStatus['PENDING'] || 0;

    // Calculate match rate (exclude pending from calculation)
    const processed = total_matched + total_flagged;
    const match_rate = processed > 0 ? (total_matched / processed) * 100 : 0;

    // Calculate average processing time (mock for demo)
    const avg_processing_time_ms = 2500;

    return NextResponse.json({
      total_today: total,
      total_matched,
      total_flagged,
      total_pending,
      match_rate: Math.round(match_rate * 10) / 10,
      avg_processing_time_ms,
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
