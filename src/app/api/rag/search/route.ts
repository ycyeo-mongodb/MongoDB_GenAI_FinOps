import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';
import { generateSingleEmbedding } from '@/lib/voyageai';

// Voyage AI model - must match the one used for document embeddings
const VOYAGE_MODEL = 'voyage-3-lite';

// Cosine similarity function for in-memory search
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const voyageApiKey = process.env.VOYAGE_API_KEY;
    if (!voyageApiKey) {
      return NextResponse.json({ error: 'VOYAGE_API_KEY not configured' }, { status: 500 });
    }
    
    const body = await request.json();
    const { query, limit = 5 } = body;
    
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }
    
    // Generate embedding for the query using Voyage AI
    console.log(`Generating query embedding with Voyage AI (${VOYAGE_MODEL})...`);
    const queryEmbedding = await generateSingleEmbedding(query, voyageApiKey, VOYAGE_MODEL);
    
    // Get all documents with embeddings
    const docs = await FinancialReconciliation.find({ 
      embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
    }).lean();
    
    if (docs.length === 0) {
      return NextResponse.json({
        success: true,
        query,
        results: [],
        total_searched: 0,
        message: 'No embedded documents found. Run embedding first.',
        provider: 'MongoDB Voyage AI',
      });
    }
    
    // Calculate similarity scores
    const scored = docs.map(doc => ({
      ...doc,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding as number[]),
    }));
    
    // Sort by similarity and take top results
    const results = scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(doc => ({
        _id: doc._id,
        similarity: Math.round(doc.similarity * 100) / 100,
        similarity_percent: Math.round(doc.similarity * 100),
        status: doc.status,
        invoice_id: doc.invoice_data?.invoice_id,
        vendor_name: doc.invoice_data?.vendor_name,
        total: doc.invoice_data?.total,
        invoice_date: doc.invoice_data?.invoice_date,
        customer_name: doc.shopify_order_data?.customer_name,
        order_number: doc.shopify_order_data?.order_number,
        discrepancy_notes: doc.discrepancy_notes?.substring(0, 100),
        embedding_text: doc.embedding_text,
      }));
    
    return NextResponse.json({
      success: true,
      query,
      results,
      total_searched: docs.length,
      provider: 'MongoDB Voyage AI',
      model: VOYAGE_MODEL,
      embedding_dimensions: queryEmbedding.length,
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
