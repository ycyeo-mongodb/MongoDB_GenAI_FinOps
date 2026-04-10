import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';

export async function POST() {
  try {
    await dbConnect();

    // Find all records and recalculate their status
    const records = await FinancialReconciliation.find({});
    
    let updated = 0;
    let matched = 0;
    let flagged = 0;

    for (const record of records) {
      const orderTotal = record.shopify_order_data?.total || 0;
      const invoiceTotal = record.invoice_data?.total || 0;
      const discrepancy = Math.abs(orderTotal - invoiceTotal);
      
      // Determine correct status
      let newStatus: string;
      if (invoiceTotal === 0 || orderTotal === 0) {
        // Missing data - keep as PENDING
        newStatus = 'PENDING';
      } else if (discrepancy <= 0.01) {
        newStatus = 'MATCHED';
        matched++;
      } else {
        newStatus = 'FLAGGED_FOR_REVIEW';
        flagged++;
      }

      // Update if status changed
      if (record.status !== newStatus) {
        await FinancialReconciliation.updateOne(
          { _id: record._id },
          { 
            $set: { 
              status: newStatus,
              discrepancy_amount: discrepancy,
            },
            $push: {
              audit_trail: {
                action: 'STATUS_RECALCULATED',
                timestamp: new Date(),
                actor: 'system:fix-status',
                details: `Status changed from ${record.status} to ${newStatus} (discrepancy: $${discrepancy.toFixed(2)})`,
              }
            }
          }
        );
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated status for ${records.length} records`,
      updated: updated,
      summary: {
        matched,
        flagged,
        total: records.length,
      }
    });
  } catch (error) {
    console.error('Fix status error:', error);
    return NextResponse.json(
      { error: 'Failed to fix status' },
      { status: 500 }
    );
  }
}

