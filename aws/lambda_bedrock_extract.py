"""
Lambda Function: Invoice Data Extraction using AWS Bedrock Claude
Deploy this to AWS Lambda with an API Gateway trigger.

Supports both:
- Text extraction: {"raw_text": "invoice text..."}
- Image extraction: {"image_base64": "base64string...", "media_type": "image/png"}

Required IAM permissions for Lambda role:
- bedrock:InvokeModel

Environment Variables (optional):
- BEDROCK_MODEL_ID: defaults to global.anthropic.claude-haiku-4-5-20251001-v1:0
"""

import json
import boto3
import base64

# Initialize Bedrock client
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')

# Default model ID - Claude Haiku supports vision
DEFAULT_MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0"

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


def lambda_handler(event, context):
    try:
        # Parse input
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', event)
        
        raw_text = body.get('raw_text', '')
        image_base64 = body.get('image_base64', '')
        media_type = body.get('media_type', 'image/png')
        
        if not raw_text and not image_base64:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({'error': 'Either raw_text or image_base64 is required'})
            }
        
        model_id = DEFAULT_MODEL_ID
            
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
            modelId=model_id,
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
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'success': True,
                'data': extracted_data,
                'extraction_type': 'image' if image_base64 else 'text',
                'model': model_id
            })
        }
        
    except json.JSONDecodeError as e:
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': 'Failed to parse AI response as JSON',
                'raw_response': ai_response_text if 'ai_response_text' in locals() else None
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
