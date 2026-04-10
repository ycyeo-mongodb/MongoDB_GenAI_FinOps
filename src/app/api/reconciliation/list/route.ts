import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // Filter by status
    const skip = (page - 1) * limit;

    // Build the aggregation pipeline - showcasing MongoDB Atlas capabilities
    const pipeline: any[] = [];

    // Stage 1: $match - Filter by status if provided
    // This is the first stage to reduce documents early (performance optimization)
    const matchStage: any = {};
    if (status && status !== 'ALL') {
      matchStage.status = status;
    }
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Stage 2: $sort - Sort by _id descending (newest first)
    pipeline.push({ $sort: { _id: -1 } });

    // Stage 3: $facet - Run multiple pipelines in parallel
    // This allows us to get both paginated results AND total count in one query
    pipeline.push({
      $facet: {
        // Pipeline 1: Get paginated items with projected fields
        items: [
          { $skip: skip },
          { $limit: limit },
          // $project - Select and transform fields for the response
          {
            $project: {
              _id: 1,
              status: 1,
              created_at: 1,
              discrepancy_amount: 1,
              // Use $ifNull to handle missing fields gracefully
              'shopify_order_data.order_id': { $ifNull: ['$shopify_order_data.order_id', 'N/A'] },
              'shopify_order_data.order_number': { $ifNull: ['$shopify_order_data.order_number', 'N/A'] },
              'shopify_order_data.total': { $ifNull: ['$shopify_order_data.total', 0] },
              'shopify_order_data.customer_name': { $ifNull: ['$shopify_order_data.customer_name', 'Unknown'] },
              'invoice_data.invoice_id': { $ifNull: ['$invoice_data.invoice_id', 'N/A'] },
              'invoice_data.total': { $ifNull: ['$invoice_data.total', 0] },
              'invoice_data.vendor_name': { $ifNull: ['$invoice_data.vendor_name', 'Unknown'] },
              // Computed field: check if amounts match
              amounts_match: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ['$shopify_order_data', null] },
                      { $ne: ['$invoice_data', null] }
                    ]
                  },
                  then: {
                    $lte: [
                      { $abs: { $subtract: ['$shopify_order_data.total', '$invoice_data.total'] } },
                      0.01
                    ]
                  },
                  else: null
                }
              }
            }
          }
        ],
        // Pipeline 2: Count total matching documents
        totalCount: [
          { $count: 'count' }
        ]
      }
    });

    // Execute the aggregation pipeline
    const result = await FinancialReconciliation.aggregate(pipeline);

    // Extract results from facet
    const items = result[0]?.items || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      // Include pipeline info for demo purposes
      _pipeline_info: {
        stages_used: ['$match', '$sort', '$facet', '$project'],
        filter_applied: status || 'none',
        description: 'MongoDB Aggregation Pipeline with $facet for parallel execution'
      }
    });
  } catch (error) {
    console.error('List API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation records' },
      { status: 500 }
    );
  }
}
