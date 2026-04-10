# AWS Lambda + API Gateway Setup for Bedrock

This guide sets up a secure API endpoint that n8n can call to extract invoice data using AWS Bedrock Claude.

---

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────┐      ┌─────────────┐
│    n8n      │ ──── │  API Gateway    │ ──── │   Lambda    │ ──── │  Bedrock    │
│  Workflow   │ POST │  /extract       │      │  Function   │      │  Claude     │
└─────────────┘      └─────────────────┘      └─────────────┘      └─────────────┘
```

---

## Step 1: Create Lambda Function

### 1.1 Go to AWS Lambda Console

1. Go to: https://console.aws.amazon.com/lambda
2. Click **"Create function"**

### 1.2 Configure Function

| Setting | Value |
|---------|-------|
| Function name | `bedrock-invoice-extractor` |
| Runtime | `Python 3.11` |
| Architecture | `x86_64` |

3. Click **"Create function"**

### 1.3 Add Code

1. In the Code tab, replace the default code with the contents of `lambda_bedrock_extract.py`
2. Click **"Deploy"**

### 1.4 Configure Timeout

1. Go to **Configuration** → **General configuration**
2. Click **Edit**
3. Set **Timeout** to `30 seconds` (Bedrock can take a few seconds)
4. Click **Save**

### 1.5 Add Bedrock Permissions

1. Go to **Configuration** → **Permissions**
2. Click on the **Role name** (opens IAM)
3. Click **"Add permissions"** → **"Attach policies"**
4. Search for and add: `AmazonBedrockFullAccess`
   - Or create a custom policy with just `bedrock:InvokeModel`
5. Click **"Add permissions"**

---

## Step 2: Create API Gateway

### 2.1 Go to API Gateway Console

1. Go to: https://console.aws.amazon.com/apigateway
2. Click **"Create API"**
3. Choose **"HTTP API"** → Click **"Build"**

### 2.2 Configure API

1. **API name**: `bedrock-invoice-api`
2. Click **"Next"**

### 2.3 Configure Routes

1. Click **"Add integration"**
2. Choose **Lambda** → Select `bedrock-invoice-extractor`
3. **Method**: `POST`
4. **Resource path**: `/extract`
5. Click **"Next"**

### 2.4 Configure Stage

1. **Stage name**: `prod`
2. Click **"Next"** → **"Create"**

### 2.5 Get Your API URL

After creation, you'll see an **Invoke URL** like:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

Your endpoint will be:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/extract
```

**Copy this URL** - you'll need it for n8n!

---

## Step 3: Test the API

### Using curl:

```bash
curl -X POST "https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "raw_text": "INVOICE\n\nABC Company\nInvoice #: INV-12345\nDate: 2024-01-15\n\nItems:\n- Widget A, Qty: 2, $50.00 each = $100.00\n\nSubtotal: $100.00\nTax: $8.00\nTotal: $108.00"
  }'
```

### Expected Response:

```json
{
  "success": true,
  "data": {
    "invoice_id": "INV-12345",
    "order_number": null,
    "vendor_name": "ABC Company",
    "line_items": [
      {
        "sku": null,
        "name": "Widget A",
        "quantity": 2,
        "unit_price": 50.00,
        "total": 100.00
      }
    ],
    "subtotal": 100.00,
    "tax": 8.00,
    "total": 108.00,
    "invoice_date": "2024-01-15"
  },
  "model": "global.anthropic.claude-haiku-4-5-20251001-v1:0"
}
```

---

## Step 4: Update n8n Workflow

Once you have your API Gateway URL, update the n8n workflow:

1. Open the reconciler workflow in n8n
2. Find the **"AI Extraction (Bedrock Claude)"** node
3. Update the URL to your API Gateway endpoint
4. No AWS credentials needed in n8n! 🎉

---

## Optional: Add API Key Authentication

For extra security, add an API key:

1. In API Gateway, go to **"API keys"**
2. Create a new key
3. Go to **"Usage plans"** → Create a plan → Add the API
4. Associate the API key with the usage plan
5. In n8n, add the header: `x-api-key: YOUR_API_KEY`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Timeout error | Increase Lambda timeout to 30s |
| Access denied to Bedrock | Add `AmazonBedrockFullAccess` policy to Lambda role |
| Model not found | Ensure Bedrock model is enabled in your AWS region |
| CORS error | API Gateway HTTP APIs have CORS enabled by default |

