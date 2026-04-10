# GenAI for Finance Operations — MongoDB Workshop

AI-powered invoice reconciliation dashboard built on MongoDB Atlas, Amazon Bedrock (Claude), and Voyage AI.

## Features

- **CFO Reconciliation Dashboard** — Real-time stats, paginated data grid, force-reconcile with audit trails
- **AI Invoice Extraction** — Upload invoice images, extract structured data with Bedrock Claude Vision
- **Hybrid RAG Search** — Ask natural-language questions using Atlas Search + Atlas Vector Search + Claude

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env.local
# Edit .env.local with your MongoDB URI, Voyage API key, and Bedrock API URL

# Seed sample data
npm run seed

# Start the application
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `VOYAGE_API_KEY` | Voyage AI API key for embeddings |
| `BEDROCK_API_URL` | AWS API Gateway URL for Bedrock Lambda |

## Atlas Indexes

For full RAG search functionality, create these indexes on the `financial_reconciliations` collection:

**Atlas Search Index** (`invoice_search`): `{ "mappings": { "dynamic": true } }`

**Atlas Vector Search Index** (`vector_index`):
```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 512, "similarity": "cosine" }
  ]
}
```

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Database**: MongoDB Atlas (Mongoose)
- **AI**: Voyage AI (embeddings), Amazon Bedrock / Claude (extraction & RAG)
- **Search**: Atlas Search (full-text), Atlas Vector Search (semantic)
