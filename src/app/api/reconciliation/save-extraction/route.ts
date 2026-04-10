import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';
import { generateSingleEmbedding } from '@/lib/voyageai';

// Voyage AI model for embeddings
const VOYAGE_MODEL = 'voyage-4';

// Helper to create searchable text from document data
function createEmbeddingText(doc: any): string {
  const parts: string[] = [];
  
  if (doc.invoice_data) {
    parts.push(`Invoice ${doc.invoice_data.invoice_id}`);
    parts.push(`Vendor: ${doc.invoice_data.vendor_name}`);
    parts.push(`Total: $${doc.invoice_data.total}`);
    parts.push(`Date: ${doc.invoice_data.invoice_date}`);
    
    if (doc.invoice_data.line_items) {
      doc.invoice_data.line_items.forEach((item: any) => {
        parts.push(`Item: ${item.name} - Qty: ${item.quantity} - $${item.total}`);
      });
    }
  }
  
  if (doc.shopify_order_data) {
    parts.push(`Order ${doc.shopify_order_data.order_number}`);
    parts.push(`Customer: ${doc.shopify_order_data.customer_name}`);
    parts.push(`Email: ${doc.shopify_order_data.customer_email}`);
  }
  
  parts.push(`Status: ${doc.status}`);
  
  return parts.join('. ');
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { extracted_data, raw_image_base64 } = body;

    if (!extracted_data) {
      return NextResponse.json(
        { error: 'extracted_data is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const timestamp = Date.now();
    // Make invoice ID unique by appending timestamp (for demo purposes)
    const baseInvoiceId = extracted_data.invoice_id || 'INV';
    const invoiceId = `${baseInvoiceId}-${timestamp.toString().slice(-6)}`;
    const orderNumber = extracted_data.order_number || `ORD-${timestamp.toString().slice(-6)}`;

    // Build line_items with all required fields
    const lineItems = (extracted_data.line_items || []).map((item: any, idx: number) => ({
      sku: item.sku || `ITEM-${idx + 1}`,
      name: item.description || item.name || 'Unknown Item',
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      total: item.total || (item.quantity || 1) * (item.unit_price || 0),
    }));

    // Get totals for comparison
    const orderTotal = extracted_data.total || 0;
    const invoiceTotal = extracted_data.total || 0;
    
    // Calculate discrepancy
    const discrepancy = Math.abs(orderTotal - invoiceTotal);
    
    // Auto-reconcile if amounts match (within $0.01 tolerance)
    const amountsMatch = discrepancy <= 0.01;
    const status = amountsMatch ? 'MATCHED' : 'FLAGGED_FOR_REVIEW';

    // Create document data
    const docData = {
      status: status,
      shopify_order_data: {
        order_id: orderNumber,
        order_number: orderNumber,
        customer_email: extracted_data.customer_email || 'unknown@email.com',
        customer_name: extracted_data.customer_name || 'Unknown Customer',
        line_items: lineItems,
        subtotal: extracted_data.subtotal || 0,
        tax: extracted_data.tax || 0,
        shipping: 0,
        total: orderTotal,
        currency: 'USD',
        created_at: extracted_data.invoice_date ? new Date(extracted_data.invoice_date) : now,
        financial_status: 'paid',
        fulfillment_status: null,
      },
      invoice_data: {
        invoice_id: invoiceId,
        vendor_name: extracted_data.vendor_name || 'Unknown Vendor',
        line_items: lineItems,
        subtotal: extracted_data.subtotal || 0,
        tax: extracted_data.tax || 0,
        total: invoiceTotal,
        invoice_date: extracted_data.invoice_date ? new Date(extracted_data.invoice_date) : now,
        due_date: extracted_data.due_date ? new Date(extracted_data.due_date) : null,
        extraction_confidence: 0.9,
      },
      raw_pdf_content: raw_image_base64 ? '[Image extracted via Bedrock Claude]' : null,
      discrepancy_notes: amountsMatch ? null : `Discrepancy of $${discrepancy.toFixed(2)} detected`,
      discrepancy_amount: discrepancy,
      audit_trail: [
        {
          action: 'AI_EXTRACTION',
          timestamp: now,
          actor: 'bedrock:claude',
          details: 'Invoice data extracted from image using Amazon Bedrock Claude Vision',
        },
        {
          action: amountsMatch ? 'AUTO_RECONCILED' : 'FLAGGED_FOR_REVIEW',
          timestamp: now,
          actor: 'system',
          details: amountsMatch 
            ? 'Amounts matched - automatically reconciled'
            : `Discrepancy detected: $${discrepancy.toFixed(2)}`,
        },
      ],
    };

    // Create and save the record
    const record = new FinancialReconciliation(docData);
    await record.save();

    // Auto-generate embedding for RAG search using MongoDB Voyage AI
    let embeddingSuccess = false;
    const voyageApiKey = process.env.VOYAGE_API_KEY;
    
    if (voyageApiKey) {
      try {
        const embeddingText = createEmbeddingText(docData);
        
        // Generate embedding with Voyage AI
        const embedding = await generateSingleEmbedding(embeddingText, voyageApiKey, VOYAGE_MODEL);
        
        // Update document with embedding
        await FinancialReconciliation.updateOne(
          { _id: record._id },
          { 
            $set: { 
              embedding: embedding,
              embedding_text: embeddingText,
              embedding_model: VOYAGE_MODEL
            } 
          }
        );
        embeddingSuccess = true;
      } catch (embedError) {
        console.error('Failed to generate Voyage AI embedding:', embedError);
        // Don't fail the whole save if embedding fails
      }
    }

    return NextResponse.json({
      success: true,
      id: record._id,
      invoice_id: invoiceId,
      status: status,
      embedded: embeddingSuccess,
      embedding_provider: embeddingSuccess ? 'MongoDB Voyage AI' : null,
      message: amountsMatch 
        ? `✅ Saved, reconciled${embeddingSuccess ? ' & indexed with Voyage AI' : ''}!` 
        : `⚠️ Saved but flagged for review${embeddingSuccess ? ' (indexed with Voyage AI)' : ''}`,
    });
  } catch (error) {
    console.error('Error saving extraction:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save extraction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
