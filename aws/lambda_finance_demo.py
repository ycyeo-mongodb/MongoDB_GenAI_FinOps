"""
Lambda Function: Finance Demo - Combined RAG & Invoice Extraction
Deploy this to AWS Lambda with an API Gateway trigger.

Supports multiple actions:
- {"action": "embed", "text": "invoice text..."}     - Generate embeddings
- {"action": "answer", "question": "...", "context": "..."}  - Answer questions with RAG
- {"action": "extract", "image_base64": "...", "media_type": "image/png"}  - Extract invoice from image
- {"action": "extract", "raw_text": "invoice text..."}  - Extract invoice from text

Required IAM permissions for Lambda role:
- bedrock:InvokeModel

Models used:
- Embeddings: amazon.titan-embed-text-v2:0
- Chat/Extraction: anthropic.claude-haiku (global.anthropic.claude-haiku-4-5-20251001-v1:0)
"""

import json
import boto3

# Initialize Bedrock client
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')

# Model IDs
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"
CHAT_MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"

# Common headers for CORS
CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

# Extraction prompt
EXTRACTION_PROMPT = """You are a precise financial data extraction agent. Extract invoice data and return ONLY valid JSON.

Extract these fields:
- invoice_id: The invoice number (e.g., INV-xxxxx or #xxxxx)
- order_number: The order/customer reference number
- vendor_name: The vendor/company name
- customer_name: The customer/client name
- line_items: Array of items with {description, quantity, unit_price, total}
- subtotal: Pre-tax subtotal (number)
- discount: Discount amount if any (number, positive value)
- tax: Tax amount (number)
- total: Final total amount (number)
- invoice_date: Date of invoice (YYYY-MM-DD format)
- due_date: Due date if shown (YYYY-MM-DD format)

Rules:
1. Return ONLY valid JSON, no explanation or markdown code blocks
2. All monetary values should be numbers (not strings), remove $ and commas
3. If a field cannot be found, use null
4. For line_items, extract as many details as visible"""


def generate_embedding(text: str) -> list:
    """Generate embedding vector for text using Titan Embeddings."""
    response = bedrock_runtime.invoke_model(
        modelId=EMBEDDING_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "inputText": text,
            "dimensions": 1024,  # Titan v2 supports 256, 512, 1024
            "normalize": True
        })
    )
    
    response_body = json.loads(response['body'].read())
    return response_body['embedding']


def answer_question(question: str, context: str) -> str:
    """Use Claude to answer a question given context from retrieved documents."""
    prompt = f"""You are a helpful financial assistant. Answer the user's question based ONLY on the invoice data provided below.

If the answer cannot be found in the context, say "I couldn't find that information in the retrieved invoices."

Be concise and specific. Include relevant numbers and dates when available.

INVOICE DATA:
{context}

USER QUESTION: {question}

ANSWER:"""

    response = bedrock_runtime.invoke_model(
        modelId=CHAT_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "temperature": 0.3,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        })
    )
    
    response_body = json.loads(response['body'].read())
    return response_body['content'][0]['text']


def extract_invoice(raw_text: str = None, image_base64: str = None, media_type: str = "image/png") -> dict:
    """Extract invoice data from text or image using Claude."""
    
    # Build message content based on input type
    if image_base64:
        # Image-based extraction using Claude's vision
        message_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": image_base64
                }
            },
            {
                "type": "text",
                "text": EXTRACTION_PROMPT + "\n\nExtract data from this invoice image:"
            }
        ]
    else:
        # Text-based extraction
        message_content = [
            {
                "type": "text",
                "text": EXTRACTION_PROMPT + "\n\nInvoice text to extract from:\n\n" + raw_text
            }
        ]
    
    # Call Bedrock
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2000,
        "temperature": 0.1,
        "messages": [
            {
                "role": "user",
                "content": message_content
            }
        ]
    }
    
    response = bedrock_runtime.invoke_model(
        modelId=CHAT_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(request_body)
    )
    
    # Parse response
    response_body = json.loads(response['body'].read())
    ai_response_text = response_body['content'][0]['text']
    
    # Try to extract JSON from response
    json_text = ai_response_text.strip()
    
    # Handle cases where AI might wrap JSON in markdown code blocks
    if json_text.startswith('```'):
        lines = json_text.split('\n')
        json_lines = [l for l in lines if not l.startswith('```')]
        json_text = '\n'.join(json_lines)
    
    # Parse the extracted JSON
    extracted_data = json.loads(json_text)
    
    return {
        "data": extracted_data,
        "extraction_type": "image" if image_base64 else "text",
        "raw_response": ai_response_text
    }


def lambda_handler(event, context):
    """Main handler for Finance Demo operations."""
    
    try:
        # Handle OPTIONS preflight request for CORS
        if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'message': 'OK'})
            }
        
        # Parse input
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', event)
        
        action = body.get('action', '')
        
        # ================== EMBED ACTION ==================
        if action == 'embed':
            text = body.get('text', '')
            if not text:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'text is required for embedding'})
                }
            
            embedding = generate_embedding(text)
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'embedding': embedding,
                    'dimensions': len(embedding),
                    'model': EMBEDDING_MODEL_ID
                })
            }
        
        # ================== ANSWER ACTION ==================
        elif action == 'answer':
            question = body.get('question', '')
            context_text = body.get('context', '')
            
            if not question or not context_text:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'question and context are required'})
                }
            
            answer = answer_question(question, context_text)
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'answer': answer,
                    'model': CHAT_MODEL_ID
                })
            }
        
        # ================== EXTRACT ACTION ==================
        elif action == 'extract':
            raw_text = body.get('raw_text', '')
            image_base64 = body.get('image_base64', '')
            media_type = body.get('media_type', 'image/png')
            
            if not raw_text and not image_base64:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Either raw_text or image_base64 is required'})
                }
            
            try:
                result = extract_invoice(
                    raw_text=raw_text if raw_text else None,
                    image_base64=image_base64 if image_base64 else None,
                    media_type=media_type
                )
                
                return {
                    'statusCode': 200,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': True,
                        'data': result['data'],
                        'extraction_type': result['extraction_type'],
                        'model': CHAT_MODEL_ID
                    })
                }
            except json.JSONDecodeError:
                return {
                    'statusCode': 200,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': False,
                        'error': 'Failed to parse AI response as JSON',
                        'raw_response': result.get('raw_response') if 'result' in locals() else None
                    })
                }
        
        # ================== HEALTH CHECK ==================
        elif action == 'health' or not action:
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'service': 'Finance Demo Lambda',
                    'available_actions': ['embed', 'answer', 'extract', 'health'],
                    'models': {
                        'embedding': EMBEDDING_MODEL_ID,
                        'chat': CHAT_MODEL_ID
                    }
                })
            }
        
        # ================== INVALID ACTION ==================
        else:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'error': f'Invalid action: {action}',
                    'valid_actions': ['embed', 'answer', 'extract', 'health']
                })
            }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

