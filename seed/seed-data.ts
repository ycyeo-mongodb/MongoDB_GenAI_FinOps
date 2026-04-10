/**
 * Seed Data Generator for GenAI Finance Reconciliation Demo
 * 
 * Run with: npm run seed
 * Or: npx tsx seed/seed-data.ts
 * 
 * Requires MONGODB_URI environment variable pointing to MongoDB Atlas
 */

import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load .env.local for Next.js compatibility
dotenv.config({ path: '.env.local' });

// Demo Product Catalog
const PRODUCTS = [
  {
    sku: 'DEMO-APP-001',
    name: 'Smart Cordless Vacuum Pro',
    price: 350.00,
  },
  {
    sku: 'DEMO-APP-002',
    name: 'Dual Zone Air Fryer XL',
    price: 199.99,
  },
  {
    sku: 'DEMO-APP-003',
    name: 'Premium Robot Vacuum',
    price: 449.99,
  },
  {
    sku: 'DEMO-APP-004',
    name: 'Professional Kitchen Blender',
    price: 119.99,
  },
];

// Customer names for realistic data
const CUSTOMERS = [
  { name: 'Sarah Johnson', email: 'sarah.johnson@email.com' },
  { name: 'Michael Chen', email: 'michael.chen@gmail.com' },
  { name: 'Emily Rodriguez', email: 'emily.r@outlook.com' },
  { name: 'David Kim', email: 'david.kim@yahoo.com' },
  { name: 'Jennifer Thompson', email: 'j.thompson@email.com' },
  { name: 'Robert Garcia', email: 'robert.g@gmail.com' },
  { name: 'Amanda Williams', email: 'a.williams@email.com' },
  { name: 'Christopher Lee', email: 'chris.lee@outlook.com' },
];

// Types
interface LineItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface AuditEntry {
  action: string;
  timestamp: Date;
  actor: string;
  details?: string;
}

interface ReconciliationDocument {
  status: 'PENDING' | 'MATCHED' | 'FLAGGED_FOR_REVIEW';
  shopify_order_data: {
    order_id: string;
    order_number: string;
    customer_name: string;
    customer_email: string;
    line_items: LineItem[];
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    currency: string;
    created_at: Date;
    financial_status: string;
    fulfillment_status: string | null;
  } | null;
  invoice_data: {
    invoice_id: string;
    vendor_name: string;
    line_items: LineItem[];
    subtotal: number;
    tax: number;
    total: number;
    invoice_date: Date;
    due_date: Date | null;
    extraction_confidence: number;
  } | null;
  discrepancy_notes: string | null;
  discrepancy_amount: number | null;
  raw_pdf_content: string | null;
  audit_trail: AuditEntry[];
  created_at: Date;
  updated_at: Date;
  reconciled_at: Date | null;
  reconciled_by: string | null;
}

// Helper functions
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateOrderId(): string {
  return `${Date.now()}${randomInt(1000, 9999)}`;
}

function generateOrderNumber(): string {
  return `${1000 + randomInt(1, 999)}`;
}

function generateInvoiceId(): string {
  return `INV-${Date.now().toString().slice(-8)}`;
}

function generateRawPdfContent(invoiceData: ReconciliationDocument['invoice_data']): string {
  if (!invoiceData) return '';
  
  const itemsText = invoiceData.line_items.map(item => 
    `- ${item.sku} | ${item.name} | Qty: ${item.quantity} | $${item.total.toFixed(2)}`
  ).join('\n');

  return `
INVOICE
=====================================
ABC Company
Appliance Distribution
123 Commerce Way
Boston, MA 02101

Invoice #: ${invoiceData.invoice_id}
Date: ${invoiceData.invoice_date.toLocaleDateString()}

BILL TO:
[Customer Name]
[Customer Address]

ITEMS:
${itemsText}

-------------------------------------
Subtotal:        $${invoiceData.subtotal.toFixed(2)}
Tax (8%):        $${invoiceData.tax.toFixed(2)}
-------------------------------------
TOTAL DUE:       $${invoiceData.total.toFixed(2)}

Payment due within 30 days.
Thank you for your business!
=====================================
`.trim();
}

function generateReconciliation(
  status: 'PENDING' | 'MATCHED' | 'FLAGGED_FOR_REVIEW',
  hoursAgo: number = 0
): ReconciliationDocument {
  const customer = randomChoice(CUSTOMERS);
  const numItems = randomInt(1, 3);
  const selectedProducts = [];
  
  for (let i = 0; i < numItems; i++) {
    const product = randomChoice(PRODUCTS);
    const qty = randomInt(1, 2);
    selectedProducts.push({
      sku: product.sku,
      name: product.name,
      quantity: qty,
      unit_price: product.price,
      total: +(product.price * qty).toFixed(2),
    });
  }

  const subtotal = +selectedProducts.reduce((sum, item) => sum + item.total, 0).toFixed(2);
  const taxRate = 0.08;
  const tax = +(subtotal * taxRate).toFixed(2);
  const shipping = Math.random() > 0.7 ? 9.99 : 0;
  const total = +(subtotal + tax + shipping).toFixed(2);

  const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const orderId = generateOrderId();
  const orderNumber = generateOrderNumber();
  const invoiceId = generateInvoiceId();

  // Shopify order data
  const shopifyData = {
    order_id: orderId,
    order_number: orderNumber,
    customer_name: customer.name,
    customer_email: customer.email,
    line_items: selectedProducts,
    subtotal,
    tax,
    shipping,
    total,
    currency: 'USD',
    created_at: createdAt,
    financial_status: 'paid',
    fulfillment_status: Math.random() > 0.5 ? 'fulfilled' : null,
  };

  // Invoice data (potentially with errors for FLAGGED status)
  let invoiceData = null;
  let discrepancyNotes = null;
  let discrepancyAmount = null;
  let rawPdfContent = null;

  if (status !== 'PENDING') {
    // Clone the line items for invoice
    const invoiceLineItems = selectedProducts.map(item => ({ ...item }));
    let invoiceSubtotal = subtotal;
    let invoiceTax = tax;
    let invoiceTotal = total;

    if (status === 'FLAGGED_FOR_REVIEW') {
      // Introduce an error
      const errorType = randomChoice(['tax', 'quantity', 'rounding']);
      
      switch (errorType) {
        case 'tax':
          invoiceTax = +(tax + 0.01 + Math.random() * 0.04).toFixed(2);
          invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
          discrepancyNotes = `Tax discrepancy detected.\n\nInvoice Tax: $${invoiceTax.toFixed(2)}\nExpected Tax: $${tax.toFixed(2)}\n\nDifference: $${(invoiceTax - tax).toFixed(2)}`;
          break;
        case 'quantity':
          if (invoiceLineItems.length > 0) {
            invoiceLineItems[0].quantity += 1;
            invoiceLineItems[0].total = +(invoiceLineItems[0].unit_price * invoiceLineItems[0].quantity).toFixed(2);
            invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
            invoiceTax = +(invoiceSubtotal * taxRate).toFixed(2);
            invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
            discrepancyNotes = `Quantity mismatch on ${invoiceLineItems[0].name}.\n\nInvoice shows: ${invoiceLineItems[0].quantity} units\nShopify shows: ${selectedProducts[0].quantity} units`;
          }
          break;
        case 'rounding':
          invoiceTotal = +(invoiceTotal + 0.01).toFixed(2);
          discrepancyNotes = `Rounding error in total.\n\nInvoice Total: $${invoiceTotal.toFixed(2)}\nExpected Total: $${total.toFixed(2)}`;
          break;
      }

      discrepancyAmount = +(invoiceTotal - total).toFixed(2);
    } else {
      discrepancyAmount = 0;
      discrepancyNotes = 'Automatic reconciliation successful. All amounts match.';
    }

    invoiceData = {
      invoice_id: invoiceId,
      vendor_name: 'ABC Company Distribution',
      line_items: invoiceLineItems,
      subtotal: invoiceSubtotal,
      tax: invoiceTax,
      total: invoiceTotal,
      invoice_date: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000), // 2 hours after order
      due_date: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days later
      extraction_confidence: status === 'MATCHED' ? 0.95 : 0.82,
    };

    rawPdfContent = generateRawPdfContent(invoiceData);
  }

  // Build audit trail
  const auditTrail: AuditEntry[] = [
    {
      action: 'SHOPIFY_ORDER_RECEIVED',
      timestamp: createdAt,
      actor: 'n8n:simulator',
      details: `Order #${orderNumber} received from Shopify webhook`,
    },
  ];

  if (status !== 'PENDING') {
    auditTrail.push({
      action: 'INVOICE_RECEIVED',
      timestamp: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
      actor: 'n8n:reconciler',
      details: `Invoice ${invoiceId} received via email`,
    });

    auditTrail.push({
      action: 'AI_EXTRACTION_COMPLETE',
      timestamp: new Date(createdAt.getTime() + 2.1 * 60 * 60 * 1000),
      actor: 'n8n:reconciler',
      details: `Data extracted with ${invoiceData?.extraction_confidence ? (invoiceData.extraction_confidence * 100).toFixed(0) : 0}% confidence`,
    });

    auditTrail.push({
      action: status === 'MATCHED' ? 'AUTO_RECONCILED' : 'FLAGGED_FOR_REVIEW',
      timestamp: new Date(createdAt.getTime() + 2.2 * 60 * 60 * 1000),
      actor: 'n8n:reconciler',
      details: status === 'MATCHED' 
        ? 'Invoice automatically reconciled - amounts match within tolerance'
        : 'Invoice flagged for manual review - discrepancy detected',
    });
  }

  return {
    status,
    shopify_order_data: shopifyData,
    invoice_data: invoiceData,
    discrepancy_notes: discrepancyNotes,
    discrepancy_amount: discrepancyAmount,
    raw_pdf_content: rawPdfContent,
    audit_trail: auditTrail,
    created_at: createdAt,
    updated_at: new Date(createdAt.getTime() + (status === 'PENDING' ? 0 : 2.2 * 60 * 60 * 1000)),
    reconciled_at: status === 'MATCHED' ? new Date(createdAt.getTime() + 2.2 * 60 * 60 * 1000) : null,
    reconciled_by: status === 'MATCHED' ? 'SYSTEM' : null,
  };
}

async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI;

  console.log('🚀 GenAI Finance Reconciliation - Seed Script\n');

  if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI environment variable is not set!\n');
    console.log('To use MongoDB Atlas, create a .env.local file with:');
    console.log('─────────────────────────────────────────────────────');
    console.log('MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/genai_finance_demo?retryWrites=true&w=majority');
    console.log('─────────────────────────────────────────────────────\n');
    console.log('Or run with the variable inline:');
    console.log('MONGODB_URI="your-connection-string" npm run seed\n');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB Atlas: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    const collection = db.collection('financial_reconciliations');

    // Clear existing data
    const deleteResult = await collection.deleteMany({});
    console.log(`✓ Cleared ${deleteResult.deletedCount} existing records\n`);

    // Generate seed data
    const records: ReconciliationDocument[] = [];

    // Today's data
    console.log('Generating today\'s records...');
    
    // 15 MATCHED (representing 80% success rate with some)
    for (let i = 0; i < 15; i++) {
      records.push(generateReconciliation('MATCHED', randomInt(1, 12)));
    }
    
    // 5 FLAGGED (representing the 20% with errors)
    for (let i = 0; i < 5; i++) {
      records.push(generateReconciliation('FLAGGED_FOR_REVIEW', randomInt(1, 10)));
    }
    
    // 3 PENDING (awaiting invoice)
    for (let i = 0; i < 3; i++) {
      records.push(generateReconciliation('PENDING', randomInt(0, 3)));
    }

    // Historical data (last 7 days)
    console.log('Generating historical records...');
    for (let day = 1; day <= 7; day++) {
      const baseHours = day * 24;
      
      // More MATCHED than FLAGGED (realistic scenario)
      for (let i = 0; i < randomInt(12, 18); i++) {
        records.push(generateReconciliation('MATCHED', baseHours + randomInt(0, 20)));
      }
      
      for (let i = 0; i < randomInt(2, 5); i++) {
        records.push(generateReconciliation('FLAGGED_FOR_REVIEW', baseHours + randomInt(0, 20)));
      }
    }

    // Insert all records
    const insertResult = await collection.insertMany(records);
    console.log(`\n✓ Inserted ${insertResult.insertedCount} reconciliation records\n`);

    // Summary
    const summary = await collection.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();

    console.log('Summary:');
    console.log('─────────────────────────────');
    summary.forEach((s: { _id: string; count: number }) => {
      const icon = s._id === 'MATCHED' ? '✅' : s._id === 'FLAGGED_FOR_REVIEW' ? '🚨' : '⏳';
      console.log(`${icon} ${s._id}: ${s.count} records`);
    });
    console.log('─────────────────────────────');
    console.log(`   Total: ${records.length} records\n`);

    console.log('🎉 Seed completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Start the Next.js app: npm run dev');
    console.log('  2. Open http://localhost:3000');
    console.log('  3. View the CFO Dashboard\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seed
seed();

