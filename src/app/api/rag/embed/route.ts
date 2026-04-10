import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';
import { generateSingleEmbedding, generateVoyageEmbedding } from '@/lib/voyageai';

// Voyage AI model - using voyage-4 (1024 dims)
const VOYAGE_MODEL = 'voyage-4';

// Helper to create searchable text from invoice data
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
  
  if (doc.discrepancy_notes) {
    parts.push(`Notes: ${doc.discrepancy_notes.substring(0, 200)}`);
  }
  
  return parts.join('. ');
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const voyageApiKey = process.env.VOYAGE_API_KEY;
    if (!voyageApiKey) {
      return NextResponse.json({ error: 'VOYAGE_API_KEY not configured' }, { status: 500 });
    }
    
    const body = await request.json();
    const { id, embedAll, batchSize = 50 } = body;
    
    if (embedAll) {
      // Find documents without embeddings
      const docs = await FinancialReconciliation.find({
        $or: [
          { embedding: { $exists: false } },
          { embedding: null },
          { embedding: { $size: 0 } }
        ]
      }).limit(batchSize);
      
      console.log(`Found ${docs.length} documents without embeddings`);
      
      if (docs.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'All documents already have embeddings',
          embedded: 0,
          remaining: 0,
          provider: 'MongoDB Voyage AI',
        });
      }
      
      // Prepare texts for batch embedding
      const texts: string[] = [];
      const docIds: string[] = [];
      
      for (const doc of docs) {
        texts.push(createEmbeddingText(doc));
        docIds.push(doc._id.toString());
      }
      
      try {
        // Generate embeddings in batch using Voyage AI
        console.log(`Generating embeddings for ${texts.length} documents with Voyage AI (${VOYAGE_MODEL})...`);
        const result = await generateVoyageEmbedding(texts, voyageApiKey, VOYAGE_MODEL);
        
        // Update documents with embeddings
        let embedded = 0;
        for (let i = 0; i < docIds.length; i++) {
          const updateResult = await FinancialReconciliation.updateOne(
            { _id: docIds[i] },
            { 
              $set: { 
                embedding: result.embeddings[i],
                embedding_text: texts[i],
                embedding_model: VOYAGE_MODEL
              } 
            }
          );
          
          if (updateResult.modifiedCount > 0) {
            embedded++;
          }
        }
        
        // Count remaining
        const remaining = await FinancialReconciliation.countDocuments({
          $or: [
            { embedding: { $exists: false } },
            { embedding: null },
            { embedding: { $size: 0 } }
          ]
        });
        
        return NextResponse.json({
          success: true,
          message: `Embedded ${embedded} documents with Voyage AI`,
          total_processed: docs.length,
          embedded,
          remaining,
          provider: 'MongoDB Voyage AI',
          model: result.model,
          tokens_used: result.tokens,
          dimensions: result.embeddings[0]?.length || 0,
        });
        
      } catch (voyageError) {
        console.error('Voyage AI batch embedding error:', voyageError);
        return NextResponse.json({
          success: false,
          error: 'Voyage AI embedding failed',
          details: voyageError instanceof Error ? voyageError.message : 'Unknown error',
        }, { status: 500 });
      }
    }
    
    if (id) {
      // Embed a specific document
      const doc = await FinancialReconciliation.findById(id);
      if (!doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      
      const text = createEmbeddingText(doc);
      
      try {
        const embedding = await generateSingleEmbedding(text, voyageApiKey, VOYAGE_MODEL);
        
        await FinancialReconciliation.updateOne(
          { _id: id },
          { 
            $set: { 
              embedding,
              embedding_text: text,
              embedding_model: VOYAGE_MODEL
            } 
          }
        );
        
        return NextResponse.json({
          success: true,
          message: 'Document embedded with Voyage AI',
          dimensions: embedding.length,
          provider: 'MongoDB Voyage AI',
          model: VOYAGE_MODEL,
        });
        
      } catch (voyageError) {
        console.error('Voyage AI single embedding error:', voyageError);
        return NextResponse.json({
          success: false,
          error: 'Voyage AI embedding failed',
          details: voyageError instanceof Error ? voyageError.message : 'Unknown error',
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ error: 'Provide id or embedAll: true' }, { status: 400 });
    
  } catch (error) {
    console.error('Embed error:', error);
    return NextResponse.json(
      { error: 'Failed to embed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
