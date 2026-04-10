/**
 * Seed 10K Documents for GenAI Finance Reconciliation Demo
 * 
 * Run with: npx tsx seed/seed-10k.ts
 * 
 * Generates 10,000 realistic financial reconciliation records
 */

import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load .env.local for Next.js compatibility
dotenv.config({ path: '.env.local' });

// Expanded Product Catalog
const PRODUCTS = [
  { sku: 'DEMO-APP-001', name: 'Smart Cordless Vacuum Pro', price: 350.00 },
  { sku: 'DEMO-APP-002', name: 'Dual Zone Air Fryer XL', price: 199.99 },
  { sku: 'DEMO-APP-003', name: 'Premium Robot Vacuum', price: 449.99 },
  { sku: 'DEMO-APP-004', name: 'Professional Kitchen Blender', price: 119.99 },
  { sku: 'DEMO-APP-005', name: 'Smart Coffee Maker Pro', price: 179.99 },
  { sku: 'DEMO-APP-006', name: 'Electric Pressure Cooker', price: 129.99 },
  { sku: 'DEMO-APP-007', name: 'Countertop Ice Maker', price: 149.99 },
  { sku: 'DEMO-APP-008', name: 'Stand Mixer Deluxe', price: 299.99 },
  { sku: 'DEMO-APP-009', name: 'Smart Toaster Oven', price: 189.99 },
  { sku: 'DEMO-APP-010', name: 'Portable Dishwasher', price: 399.99 },
  { sku: 'DEMO-APP-011', name: 'Food Dehydrator Pro', price: 89.99 },
  { sku: 'DEMO-APP-012', name: 'Electric Kettle Smart', price: 69.99 },
  { sku: 'DEMO-APP-013', name: 'Juice Extractor Plus', price: 159.99 },
  { sku: 'DEMO-APP-014', name: 'Wine Cooler Cabinet', price: 549.99 },
  { sku: 'DEMO-APP-015', name: 'Indoor Grill Station', price: 229.99 },
];

// Expanded Customer names for realistic data
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
  'Timothy', 'Deborah', 'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon',
  'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Chen', 'Kim', 'Park', 'Singh', 'Patel', 'Shah', 'Kumar'
];

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'email.com', 'hotmail.com', 'icloud.com'];

// Vendor names
const VENDORS = [
  'ABC Company Distribution',
  'XYZ Appliances Inc',
  'Global Electronics Co',
  'Premium Home Goods LLC',
  'Quality Distributors',
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

function generateCustomer() {
  const firstName = randomChoice(FIRST_NAMES);
  const lastName = randomChoice(LAST_NAMES);
  const domain = randomChoice(EMAIL_DOMAINS);
  return {
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@${domain}`,
  };
}

let orderCounter = 100000;
let invoiceCounter = 1000000;

function generateOrderId(): string {
  return `${Date.now()}${randomInt(1000, 9999)}`;
}

function generateOrderNumber(): string {
  orderCounter++;
  return `${orderCounter}`;
}

function generateInvoiceId(): string {
  invoiceCounter++;
  return `INV-${invoiceCounter}`;
}

function generateRawPdfContent(invoiceData: ReconciliationDocument['invoice_data'], customerName: string): string {
  if (!invoiceData) return '';
  
  const itemsText = invoiceData.line_items.map(item => 
    `- ${item.sku} | ${item.name} | Qty: ${item.quantity} | $${item.total.toFixed(2)}`
  ).join('\n');

  return `
INVOICE
=====================================
${invoiceData.vendor_name}
Appliance Distribution
123 Commerce Way
Boston, MA 02101

Invoice #: ${invoiceData.invoice_id}
Date: ${invoiceData.invoice_date.toLocaleDateString()}

BILL TO:
${customerName}
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
  daysAgo: number = 0,
  hoursOffset: number = 0
): ReconciliationDocument {
  const customer = generateCustomer();
  const numItems = randomInt(1, 4);
  const selectedProducts: LineItem[] = [];
  const usedSkus = new Set<string>();
  
  for (let i = 0; i < numItems; i++) {
    let product = randomChoice(PRODUCTS);
    // Avoid duplicates in same order
    while (usedSkus.has(product.sku) && usedSkus.size < PRODUCTS.length) {
      product = randomChoice(PRODUCTS);
    }
    usedSkus.add(product.sku);
    
    const qty = randomInt(1, 3);
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
  const shipping = Math.random() > 0.6 ? +(randomInt(5, 15) + 0.99).toFixed(2) : 0;
  const total = +(subtotal + tax + shipping).toFixed(2);

  const hoursAgo = daysAgo * 24 + hoursOffset;
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
    fulfillment_status: Math.random() > 0.3 ? 'fulfilled' : null,
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
      const errorType = randomChoice(['tax', 'quantity', 'rounding', 'price', 'missing_item']);
      
      switch (errorType) {
        case 'tax':
          const taxError = +(0.01 + Math.random() * 0.10).toFixed(2);
          invoiceTax = +(tax + taxError).toFixed(2);
          invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
          discrepancyNotes = `Tax discrepancy detected.\n\nInvoice Tax: $${invoiceTax.toFixed(2)}\nExpected Tax: $${tax.toFixed(2)}\n\nDifference: $${taxError.toFixed(2)}\n\nPossible cause: Incorrect tax rate applied or calculation error.`;
          break;
        case 'quantity':
          if (invoiceLineItems.length > 0) {
            const itemIdx = randomInt(0, invoiceLineItems.length - 1);
            const qtyDiff = randomInt(1, 2);
            invoiceLineItems[itemIdx].quantity += qtyDiff;
            invoiceLineItems[itemIdx].total = +(invoiceLineItems[itemIdx].unit_price * invoiceLineItems[itemIdx].quantity).toFixed(2);
            invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
            invoiceTax = +(invoiceSubtotal * taxRate).toFixed(2);
            invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
            discrepancyNotes = `Quantity mismatch on ${invoiceLineItems[itemIdx].name}.\n\nInvoice shows: ${invoiceLineItems[itemIdx].quantity} units\nShopify shows: ${selectedProducts[itemIdx].quantity} units\n\nDifference: ${qtyDiff} unit(s)\n\nAction required: Verify actual shipment quantity.`;
          }
          break;
        case 'rounding':
          const roundingError = +(0.01 + Math.random() * 0.05).toFixed(2);
          invoiceTotal = +(invoiceTotal + roundingError).toFixed(2);
          discrepancyNotes = `Rounding error in total.\n\nInvoice Total: $${invoiceTotal.toFixed(2)}\nExpected Total: $${total.toFixed(2)}\n\nDifference: $${roundingError.toFixed(2)}\n\nLikely cause: Different rounding rules applied.`;
          break;
        case 'price':
          if (invoiceLineItems.length > 0) {
            const itemIdx = randomInt(0, invoiceLineItems.length - 1);
            const priceError = +(Math.random() * 20).toFixed(2);
            invoiceLineItems[itemIdx].unit_price = +(invoiceLineItems[itemIdx].unit_price + priceError).toFixed(2);
            invoiceLineItems[itemIdx].total = +(invoiceLineItems[itemIdx].unit_price * invoiceLineItems[itemIdx].quantity).toFixed(2);
            invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
            invoiceTax = +(invoiceSubtotal * taxRate).toFixed(2);
            invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
            discrepancyNotes = `Price mismatch on ${invoiceLineItems[itemIdx].name}.\n\nInvoice price: $${invoiceLineItems[itemIdx].unit_price.toFixed(2)}\nExpected price: $${selectedProducts[itemIdx].unit_price.toFixed(2)}\n\nDifference: $${priceError.toFixed(2)} per unit\n\nPossible cause: Outdated price list or manual entry error.`;
          }
          break;
        case 'missing_item':
          if (invoiceLineItems.length > 1) {
            const removedItem = invoiceLineItems.pop()!;
            invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
            invoiceTax = +(invoiceSubtotal * taxRate).toFixed(2);
            invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
            discrepancyNotes = `Missing item in invoice.\n\nExpected item not found: ${removedItem.name}\nSKU: ${removedItem.sku}\nQuantity: ${removedItem.quantity}\nValue: $${removedItem.total.toFixed(2)}\n\nAction required: Contact vendor to verify shipment.`;
          }
          break;
      }

      discrepancyAmount = +(invoiceTotal - total).toFixed(2);
    } else {
      discrepancyAmount = 0;
      discrepancyNotes = 'Automatic reconciliation successful. All amounts match within tolerance.';
    }

    invoiceData = {
      invoice_id: invoiceId,
      vendor_name: randomChoice(VENDORS),
      line_items: invoiceLineItems,
      subtotal: invoiceSubtotal,
      tax: invoiceTax,
      total: invoiceTotal,
      invoice_date: new Date(createdAt.getTime() + randomInt(1, 4) * 60 * 60 * 1000),
      due_date: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      extraction_confidence: status === 'MATCHED' ? 0.92 + Math.random() * 0.08 : 0.70 + Math.random() * 0.20,
    };

    rawPdfContent = generateRawPdfContent(invoiceData, customer.name);
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
    const invoiceReceivedTime = new Date(createdAt.getTime() + randomInt(1, 4) * 60 * 60 * 1000);
    auditTrail.push({
      action: 'INVOICE_RECEIVED',
      timestamp: invoiceReceivedTime,
      actor: 'n8n:reconciler',
      details: `Invoice ${invoiceId} received via email`,
    });

    auditTrail.push({
      action: 'AI_EXTRACTION_COMPLETE',
      timestamp: new Date(invoiceReceivedTime.getTime() + randomInt(5, 30) * 1000),
      actor: 'n8n:reconciler',
      details: `Data extracted with ${invoiceData?.extraction_confidence ? (invoiceData.extraction_confidence * 100).toFixed(0) : 0}% confidence`,
    });

    auditTrail.push({
      action: status === 'MATCHED' ? 'AUTO_RECONCILED' : 'FLAGGED_FOR_REVIEW',
      timestamp: new Date(invoiceReceivedTime.getTime() + randomInt(30, 120) * 1000),
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
    updated_at: new Date(createdAt.getTime() + (status === 'PENDING' ? 0 : randomInt(1, 5) * 60 * 60 * 1000)),
    reconciled_at: status === 'MATCHED' ? new Date(createdAt.getTime() + randomInt(2, 6) * 60 * 60 * 1000) : null,
    reconciled_by: status === 'MATCHED' ? 'SYSTEM' : null,
  };
}

async function seed10k() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const TOTAL_RECORDS = 10000;
  const BATCH_SIZE = 500;

  console.log('🚀 GenAI Finance Reconciliation - 10K Seed Script\n');
  console.log(`Target: ${TOTAL_RECORDS.toLocaleString()} documents\n`);

  if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI environment variable is not set!');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB Atlas...`);

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

    // Distribution: 75% MATCHED, 20% FLAGGED, 5% PENDING
    const matchedCount = Math.floor(TOTAL_RECORDS * 0.75);
    const flaggedCount = Math.floor(TOTAL_RECORDS * 0.20);
    const pendingCount = TOTAL_RECORDS - matchedCount - flaggedCount;

    console.log('Distribution:');
    console.log(`  ✅ MATCHED: ${matchedCount.toLocaleString()} (75%)`);
    console.log(`  🚨 FLAGGED: ${flaggedCount.toLocaleString()} (20%)`);
    console.log(`  ⏳ PENDING: ${pendingCount.toLocaleString()} (5%)`);
    console.log('');

    // Generate records with realistic time distribution (last 30 days)
    let totalInserted = 0;
    let batch: ReconciliationDocument[] = [];

    const statusQueue: ('MATCHED' | 'FLAGGED_FOR_REVIEW' | 'PENDING')[] = [];
    
    // Fill the queue with statuses
    for (let i = 0; i < matchedCount; i++) statusQueue.push('MATCHED');
    for (let i = 0; i < flaggedCount; i++) statusQueue.push('FLAGGED_FOR_REVIEW');
    for (let i = 0; i < pendingCount; i++) statusQueue.push('PENDING');
    
    // Shuffle the queue for random distribution
    for (let i = statusQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [statusQueue[i], statusQueue[j]] = [statusQueue[j], statusQueue[i]];
    }

    console.log('Generating and inserting records...\n');
    const startTime = Date.now();

    for (let i = 0; i < TOTAL_RECORDS; i++) {
      const status = statusQueue[i];
      
      // Distribute across last 30 days with more recent bias
      const daysAgo = Math.floor(Math.pow(Math.random(), 2) * 30); // Quadratic distribution - more recent
      const hoursOffset = randomInt(0, 23);
      
      batch.push(generateReconciliation(status, daysAgo, hoursOffset));

      // Insert in batches
      if (batch.length >= BATCH_SIZE) {
        await collection.insertMany(batch);
        totalInserted += batch.length;
        
        const progress = ((totalInserted / TOTAL_RECORDS) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(`\r  Progress: ${progress}% (${totalInserted.toLocaleString()}/${TOTAL_RECORDS.toLocaleString()}) - ${elapsed}s elapsed`);
        
        batch = [];
      }
    }

    // Insert remaining records
    if (batch.length > 0) {
      await collection.insertMany(batch);
      totalInserted += batch.length;
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\n✓ Inserted ${totalInserted.toLocaleString()} records in ${totalTime}s\n`);

    // Create indexes for better query performance
    console.log('Creating indexes...');
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ created_at: -1 });
    await collection.createIndex({ 'shopify_order_data.order_number': 1 });
    await collection.createIndex({ 'invoice_data.invoice_id': 1 });
    console.log('✓ Indexes created\n');

    // Summary
    const summary = await collection.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('═══════════════════════════════════════');
    console.log('           SEED SUMMARY');
    console.log('═══════════════════════════════════════');
    summary.forEach((s: { _id: string; count: number }) => {
      const icon = s._id === 'MATCHED' ? '✅' : s._id === 'FLAGGED_FOR_REVIEW' ? '🚨' : '⏳';
      const pct = ((s.count / TOTAL_RECORDS) * 100).toFixed(1);
      console.log(`  ${icon} ${s._id.padEnd(20)} ${s.count.toLocaleString().padStart(6)} (${pct}%)`);
    });
    console.log('───────────────────────────────────────');
    console.log(`     TOTAL: ${totalInserted.toLocaleString()} records`);
    console.log('═══════════════════════════════════════\n');

    console.log('🎉 10K Seed completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seed
seed10k();

