"""
Lambda Function: RAG Support for Invoice Search using AWS Bedrock
Deploy this to AWS Lambda with an API Gateway trigger.

Supports:
- Generate embeddings: {"action": "embed", "text": "invoice text..."}
- Answer questions: {"action": "answer", "question": "...", "context": "..."}

Required IAM permissions for Lambda role:
- bedrock:InvokeModel

Models used:
- Embeddings: amazon.titan-embed-text-v2:0
- Chat: anthropic.claude-haiku (your existing model)
"""

import json
import boto3

# Initialize Bedrock client
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')

# Model IDs
EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"
CHAT_MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"


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


def lambda_handler(event, context):
    """Main handler for RAG operations."""
    
    try:
        # Parse input
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', event)
        
        action = body.get('action', '')
        
        headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        }
        
        if action == 'embed':
            # Generate embedding for text
            text = body.get('text', '')
            if not text:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'text is required for embedding'})
                }
            
            embedding = generate_embedding(text)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'success': True,
                    'embedding': embedding,
                    'dimensions': len(embedding),
                    'model': EMBEDDING_MODEL_ID
                })
            }
        
        elif action == 'answer':
            # Answer question with context
            question = body.get('question', '')
            context_text = body.get('context', '')
            
            if not question or not context_text:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'question and context are required'})
                }
            
            answer = answer_question(question, context_text)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'success': True,
                    'answer': answer,
                    'model': CHAT_MODEL_ID
                })
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Invalid action. Use "embed" or "answer"',
                    'valid_actions': ['embed', 'answer']
                })
            }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

