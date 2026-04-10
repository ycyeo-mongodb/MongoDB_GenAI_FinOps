import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { id, user_email, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Reconciliation ID is required' },
        { status: 400 }
      );
    }

    const reconciliation = await FinancialReconciliation.findById(id);

    if (!reconciliation) {
      return NextResponse.json(
        { error: 'Reconciliation not found' },
        { status: 404 }
      );
    }

    // Update to MATCHED status
    reconciliation.status = 'MATCHED';
    reconciliation.reconciled_at = new Date();
    reconciliation.reconciled_by = user_email || 'MANUAL_OVERRIDE';

    // Add audit trail entry
    reconciliation.audit_trail.push({
      action: 'FORCE_RECONCILE',
      timestamp: new Date(),
      actor: user_email ? `USER:${user_email}` : 'USER:UNKNOWN',
      details: notes || 'Manual force reconciliation via CFO Dashboard',
    });

    // Append to discrepancy notes if there are manual notes
    if (notes) {
      reconciliation.discrepancy_notes = reconciliation.discrepancy_notes
        ? `${reconciliation.discrepancy_notes}\n\n[MANUAL OVERRIDE]: ${notes}`
        : `[MANUAL OVERRIDE]: ${notes}`;
    }

    await reconciliation.save();

    return NextResponse.json({
      success: true,
      message: 'Reconciliation forced successfully',
      reconciliation: {
        _id: reconciliation._id,
        status: reconciliation.status,
        reconciled_at: reconciliation.reconciled_at,
        reconciled_by: reconciliation.reconciled_by,
      },
    });
  } catch (error) {
    console.error('Force Reconcile API Error:', error);
    return NextResponse.json(
      { error: 'Failed to force reconcile' },
      { status: 500 }
    );
  }
}

