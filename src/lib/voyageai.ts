/**
 * Voyage AI Embeddings Client
 * 
 * MongoDB Atlas has a partnership with Voyage AI for vector search.
 * Using MongoDB's Voyage AI endpoint.
 * 
 * Models available:
 * - voyage-4-large: Latest large model (1024 dims)
 * - voyage-3: General-purpose (1024 dims)
 * - voyage-3-lite: Faster, smaller (512 dims)
 * - voyage-finance-2: Optimized for financial documents (1024 dims)
 */

// MongoDB's Voyage AI endpoint
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';

// Default model - voyage-3-lite for efficiency
const DEFAULT_MODEL = 'voyage-3-lite';

export interface VoyageEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

export async function generateVoyageEmbedding(
  text: string | string[],
  apiKey: string,
  model: string = DEFAULT_MODEL
): Promise<{ embeddings: number[][]; model: string; tokens: number }> {
  const input = Array.isArray(text) ? text : [text];

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI API error: ${response.status} - ${error}`);
  }

  const data: VoyageEmbeddingResponse = await response.json();

  return {
    embeddings: data.data.map(d => d.embedding),
    model: data.model,
    tokens: data.usage.total_tokens,
  };
}

export async function generateSingleEmbedding(
  text: string,
  apiKey: string,
  model: string = DEFAULT_MODEL
): Promise<number[]> {
  const result = await generateVoyageEmbedding(text, apiKey, model);
  return result.embeddings[0];
}

