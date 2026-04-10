import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import FinancialReconciliation from '@/lib/models/FinancialReconciliation';
import { generateSingleEmbedding } from '@/lib/voyageai';
import mongoose from 'mongoose';

// Bedrock Lambda for LLM (Claude) - still used for answer generation
const BEDROCK_RAG_URL = process.env.BEDROCK_API_URL;

if (!BEDROCK_RAG_URL) {
  console.error('BEDROCK_API_URL environment variable is not set');
}

// Voyage AI model - must match the one used for document embeddings
const VOYAGE_MODEL = 'voyage-4';

// Cosine similarity function (fallback for manual calculation)
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

// Extract potential search terms from the question
function extractSearchTerms(question: string): string[] {
  const terms: string[] = [];
  
  // Extract anything that looks like an ID (alphanumeric with dashes/underscores)
  const idMatches = question.match(/[A-Z0-9][-_A-Z0-9]{3,}/gi);
  if (idMatches) {
    terms.push(...idMatches);
  }
  
  return [...new Set(terms)]; // Remove duplicates
}

export async function POST(request: NextRequest) {
  if (!BEDROCK_RAG_URL) {
    return NextResponse.json(
      { error: 'BEDROCK_API_URL is not configured. Set it in .env.local' },
      { status: 503 }
    );
  }

  try {
    await dbConnect();
    
    const voyageApiKey = process.env.VOYAGE_API_KEY;
    if (!voyageApiKey) {
      return NextResponse.json({ error: 'VOYAGE_API_KEY not configured' }, { status: 500 });
    }
    
    const body = await request.json();
    const { question, topK = 5 } = body;
    
    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    const searchMethods: string[] = [];
    let atlasSearchDocs: any[] = [];
    let vectorSearchDocs: { doc: any; score: number }[] = [];

    // ============================================
    // STEP 1: MongoDB Atlas Full-Text Search
    // Uses $search aggregation with Lucene index
    // ============================================
    const searchTerms = extractSearchTerms(question);
    
    if (searchTerms.length > 0) {
      try {
        // Use MongoDB Atlas Search ($search aggregation)
        const searchQuery = searchTerms.join(' ');
        
        const atlasSearchPipeline = [
          {
            $search: {
              index: 'invoice_search', // Atlas Search index name
              compound: {
                should: [
                  // Search in invoice_id (exact keyword match)
                  {
                    text: {
                      query: searchQuery,
                      path: 'invoice_data.invoice_id',
                      score: { boost: { value: 10 } } // High boost for exact ID match
                    }
                  },
                  // Search in order_number
                  {
                    text: {
                      query: searchQuery,
                      path: 'shopify_order_data.order_number',
                      score: { boost: { value: 8 } }
                    }
                  },
                  // Search in vendor_name
                  {
                    text: {
                      query: searchQuery,
                      path: 'invoice_data.vendor_name',
                      score: { boost: { value: 5 } }
                    }
                  },
                  // Search in customer_name
                  {
                    text: {
                      query: searchQuery,
                      path: 'shopify_order_data.customer_name',
                      score: { boost: { value: 5 } }
                    }
                  },
                  // Full-text search in embedding_text (semantic content)
                  {
                    text: {
                      query: question,
                      path: 'embedding_text',
                      score: { boost: { value: 2 } }
                    }
                  }
                ],
                minimumShouldMatch: 1
              }
            }
          },
          {
            $addFields: {
              searchScore: { $meta: 'searchScore' }
            }
          },
          {
            $sort: { searchScore: -1 }
          },
          {
            $limit: topK
          }
        ];

        const collection = mongoose.connection.db!.collection('financial_reconciliations');
        atlasSearchDocs = await collection.aggregate(atlasSearchPipeline).toArray();
        
        if (atlasSearchDocs.length > 0) {
          searchMethods.push('Atlas Search');
          console.log(`✅ Atlas Search found ${atlasSearchDocs.length} docs for: "${searchQuery}"`);
        }
      } catch (searchError: any) {
        // Atlas Search index might not exist yet - fall back to basic find
        console.log(`⚠️ Atlas Search unavailable (${searchError.message}), using fallback`);
        
        // Fallback: basic MongoDB find with regex
        const fallbackDocs = await FinancialReconciliation.find({
          $or: searchTerms.map(term => ({
            $or: [
              { 'invoice_data.invoice_id': { $regex: term, $options: 'i' } },
              { 'shopify_order_data.order_number': { $regex: term, $options: 'i' } }
            ]
          }))
        }).limit(topK).lean();
        
        if (fallbackDocs.length > 0) {
          atlasSearchDocs = fallbackDocs.map(doc => ({ ...doc, searchScore: 1.0 }));
          searchMethods.push('MongoDB Find (fallback)');
        }
      }
    }

    // ============================================
    // STEP 2: MongoDB Atlas Vector Search
    // Uses Voyage AI for query embedding
    // ============================================
    const atlasSearchIds = atlasSearchDocs.map(d => d._id.toString());
    
    // Generate embedding for the question using MongoDB Voyage AI
    console.log(`Generating query embedding with Voyage AI (${VOYAGE_MODEL})...`);
    const queryEmbedding = await generateSingleEmbedding(question, voyageApiKey, VOYAGE_MODEL);
    
    try {
      // Use MongoDB Atlas Vector Search ($vectorSearch)
      const collection = mongoose.connection.db!.collection('financial_reconciliations');
      
      const vectorSearchPipeline = [
        {
          $vectorSearch: {
            index: 'vector_index', // Atlas Vector Search index
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: topK * 2 // Get more candidates to filter out Atlas Search duplicates
          }
        },
        {
          $addFields: {
            vectorScore: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      const vectorResults = await collection.aggregate(vectorSearchPipeline).toArray();
      
      // Filter out documents already found by Atlas Search
      vectorSearchDocs = vectorResults
        .filter(doc => !atlasSearchIds.includes(doc._id.toString()))
        .slice(0, topK - atlasSearchDocs.length)
        .map(doc => ({ doc, score: doc.vectorScore || 0 }));
      
      if (vectorSearchDocs.length > 0) {
        searchMethods.push('Atlas Vector Search (Voyage AI)');
        console.log(`✅ Vector Search found ${vectorSearchDocs.length} additional docs`);
      }
    } catch (vectorError: any) {
      console.log(`⚠️ Vector Search unavailable (${vectorError.message}), using manual cosine`);
      
      // Fallback: manual cosine similarity calculation
      const docs = await FinancialReconciliation.find({ 
        embedding: { $exists: true, $ne: null },
        _id: { $nin: atlasSearchIds }
      }).lean();
      
      const scored = docs.map(doc => ({
        doc,
        score: cosineSimilarity(queryEmbedding, doc.embedding as number[]),
      }));
      
      vectorSearchDocs = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK - atlasSearchDocs.length);
      
      if (vectorSearchDocs.length > 0) {
        searchMethods.push('Cosine Similarity (Voyage AI embeddings)');
      }
    }

    // ============================================
    // STEP 3: Combine Results (Hybrid Search)
    // Atlas Search results first, then Vector Search
    // ============================================
    let combinedDocs = [
      ...atlasSearchDocs.map(doc => ({ 
        doc, 
        score: doc.searchScore || 1.0, 
        matchType: 'atlas_search' as const
      })),
      ...vectorSearchDocs.map(d => ({ 
        doc: d.doc, 
        score: d.score, 
        matchType: 'vector_search' as const 
      })),
    ].slice(0, topK);

    // FALLBACK: If no results found, try a simple text search on embedding_text
    if (combinedDocs.length === 0 && searchTerms.length > 0) {
      console.log('⚠️ No results from Atlas/Vector search, trying text fallback...');
      
      const textFallbackDocs = await FinancialReconciliation.find({
        $or: searchTerms.flatMap(term => [
          { 'invoice_data.invoice_id': { $regex: term, $options: 'i' } },
          { 'shopify_order_data.order_number': { $regex: term, $options: 'i' } },
          { 'embedding_text': { $regex: term, $options: 'i' } }
        ])
      }).limit(topK).lean();
      
      if (textFallbackDocs.length > 0) {
        combinedDocs = textFallbackDocs.map(doc => ({
          doc,
          score: 1.0,
          matchType: 'text_search' as const
        }));
        searchMethods.push('Text Search (fallback)');
        console.log(`✅ Text fallback found ${textFallbackDocs.length} docs`);
      }
    }

    if (combinedDocs.length === 0) {
      return NextResponse.json({
        success: true,
        question,
        answer: "I couldn't find any relevant invoices in the database. Try searching with different terms, or make sure documents have been embedded first.",
        sources: [],
        total_docs_searched: 0,
        search_methods: searchMethods,
        embedding_provider: 'MongoDB Voyage AI',
      });
    }
    
    // ============================================
    // STEP 4: Build Context for LLM
    // ============================================
    const context = combinedDocs.map((item, idx) => {
      const d = item.doc;
      const matchLabel = item.matchType === 'atlas_search' 
        ? `🔍 Atlas Search (score: ${item.score.toFixed(2)})` 
        : item.matchType === 'text_search'
        ? `📝 Text Search (exact match)`
        : `🧠 Vector Search (similarity: ${(item.score * 100).toFixed(1)}%)`;
      return `[Document ${idx + 1} - ${matchLabel}]
Invoice ID: ${d.invoice_data?.invoice_id || 'N/A'}
Vendor: ${d.invoice_data?.vendor_name || 'N/A'}
Customer: ${d.shopify_order_data?.customer_name || 'N/A'}
Order Number: ${d.shopify_order_data?.order_number || 'N/A'}
Invoice Total: $${d.invoice_data?.total || 0}
Order Total: $${d.shopify_order_data?.total || 0}
Date: ${d.invoice_data?.invoice_date || d.created_at || 'N/A'}
Status: ${d.status}
Discrepancy: ${d.discrepancy_notes?.substring(0, 150) || 'None'}
Items: ${d.invoice_data?.line_items?.map((i: any) => `${i.name || i.description} x${i.quantity} = $${i.total}`).join(', ') || 'N/A'}
---`;
    }).join('\n\n');
    
    // ============================================
    // STEP 5: Generate Answer with Claude (Bedrock)
    // ============================================
    const answerResponse = await fetch(BEDROCK_RAG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'answer', question, context }),
    });
    
    const answerResult = await answerResponse.json();
    
    if (!answerResult.success) {
      return NextResponse.json({ error: 'Failed to generate answer' }, { status: 500 });
    }
    
    // ============================================
    // STEP 6: Return Results with Search Metadata
    // ============================================
    return NextResponse.json({
      success: true,
      question,
      answer: answerResult.answer,
      sources: combinedDocs.map(item => ({
        invoice_id: item.doc.invoice_data?.invoice_id,
        vendor: item.doc.invoice_data?.vendor_name,
        total: item.doc.invoice_data?.total,
        score: item.matchType === 'atlas_search' 
          ? item.score.toFixed(2) 
          : Math.round(item.score * 100),
        match_type: item.matchType,
      })),
      total_docs_searched: combinedDocs.length,
      search_methods: searchMethods,
      embedding_provider: 'MongoDB Voyage AI',
      embedding_model: VOYAGE_MODEL,
      llm_provider: 'Amazon Bedrock (Claude)',
      mongodb_features: {
        atlas_search: atlasSearchDocs.length > 0,
        vector_search: vectorSearchDocs.length > 0,
        hybrid: atlasSearchDocs.length > 0 && vectorSearchDocs.length > 0,
      },
    });
    
  } catch (error) {
    console.error('Ask error:', error);
    return NextResponse.json(
      { error: 'Failed to answer question', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
