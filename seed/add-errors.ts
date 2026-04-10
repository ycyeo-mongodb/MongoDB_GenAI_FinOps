/**
 * Add 150 Error Records to GenAI Finance Demo
 */

import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });

const PRODUCTS = [
  { sku: 'DEMO-APP-001', name: 'Smart Cordless Vacuum Pro', price: 350.00 },
  { sku: 'DEMO-APP-002', name: 'Dual Zone Air Fryer XL', price: 199.99 },
  { sku: 'DEMO-APP-003', name: 'Premium Robot Vacuum', price: 449.99 },
  { sku: 'DEMO-APP-004', name: 'Professional Kitchen Blender', price: 119.99 },
  { sku: 'DEMO-APP-005', name: 'Smart Coffee Maker Pro', price: 179.99 },
  { sku: 'DEMO-APP-006', name: 'Electric Pressure Cooker', price: 129.99 },
  { sku: 'DEMO-APP-007', name: 'Countertop Ice Maker', price: 149.99 },
];

const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Susan', 'Richard', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas'];
const VENDORS = ['ABC Company Distribution', 'XYZ Appliances Inc', 'Global Electronics Co', 'Premium Home Goods LLC', 'Quality Distributors'];

const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

let orderCounter = 300000;
let invoiceCounter = 3000000;

function generateFlaggedRecord(hoursAgo: number) {
  const firstName = randomChoice(FIRST_NAMES);
  const lastName = randomChoice(LAST_NAMES);
  const customer = { 
    name: `${firstName} ${lastName}`, 
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1,999)}@gmail.com` 
  };
  
  const numItems = randomInt(1, 3);
  const selectedProducts: any[] = [];
  for (let i = 0; i < numItems; i++) {
    const product = randomChoice(PRODUCTS);
    const qty = randomInt(1, 2);
    selectedProducts.push({ 
      sku: product.sku, 
      name: product.name, 
      quantity: qty, 
      unit_price: product.price, 
      total: +(product.price * qty).toFixed(2) 
    });
  }

  const subtotal = +selectedProducts.reduce((sum, item) => sum + item.total, 0).toFixed(2);
  const tax = +(subtotal * 0.08).toFixed(2);
  const shipping = Math.random() > 0.6 ? 9.99 : 0;
  const total = +(subtotal + tax + shipping).toFixed(2);

  const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  orderCounter++;
  invoiceCounter++;
  const orderId = Date.now().toString() + randomInt(1000, 9999);
  const orderNumber = orderCounter.toString();
  const invoiceId = `INV-${invoiceCounter}`;

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

  // Create invoice with error
  const invoiceLineItems = selectedProducts.map(item => ({ ...item }));
  let invoiceSubtotal = subtotal;
  let invoiceTax = tax;
  let invoiceTotal = total;
  let discrepancyNotes = '';

  const errorTypes = ['tax', 'quantity', 'rounding', 'price', 'missing_item', 'duplicate_charge', 'wrong_sku', 'shipping_overcharge'];
  const errorType = randomChoice(errorTypes);
  
  switch (errorType) {
    case 'tax':
      const taxError = +(0.10 + Math.random() * 2.00).toFixed(2);
      invoiceTax = +(tax + taxError).toFixed(2);
      invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
      discrepancyNotes = `⚠️ TAX DISCREPANCY ALERT\n\nInvoice Tax: $${invoiceTax.toFixed(2)}\nExpected Tax: $${tax.toFixed(2)}\nOvercharge: $${taxError.toFixed(2)}\n\n🔴 REQUIRES IMMEDIATE REVIEW\nPossible cause: Incorrect tax rate applied (possibly charged state + local tax twice)`;
      break;
      
    case 'quantity':
      if (invoiceLineItems.length > 0) {
        const extraQty = randomInt(2, 5);
        invoiceLineItems[0].quantity += extraQty;
        invoiceLineItems[0].total = +(invoiceLineItems[0].unit_price * invoiceLineItems[0].quantity).toFixed(2);
        invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
        invoiceTax = +(invoiceSubtotal * 0.08).toFixed(2);
        invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
        discrepancyNotes = `⚠️ QUANTITY MISMATCH\n\nProduct: ${invoiceLineItems[0].name}\nInvoice shows: ${invoiceLineItems[0].quantity} units\nShopify order: ${selectedProducts[0].quantity} units\nExtra charged: ${extraQty} units\n\n💰 Overcharge amount: $${(extraQty * invoiceLineItems[0].unit_price).toFixed(2)}\n\n🔴 ACTION: Verify actual shipment quantity with warehouse`;
      }
      break;
      
    case 'price':
      if (invoiceLineItems.length > 0) {
        const priceError = +(10 + Math.random() * 50).toFixed(2);
        const originalPrice = invoiceLineItems[0].unit_price;
        invoiceLineItems[0].unit_price = +(invoiceLineItems[0].unit_price + priceError).toFixed(2);
        invoiceLineItems[0].total = +(invoiceLineItems[0].unit_price * invoiceLineItems[0].quantity).toFixed(2);
        invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
        invoiceTax = +(invoiceSubtotal * 0.08).toFixed(2);
        invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
        discrepancyNotes = `⚠️ PRICE DISCREPANCY\n\nProduct: ${invoiceLineItems[0].name}\nSKU: ${invoiceLineItems[0].sku}\n\nInvoice price: $${invoiceLineItems[0].unit_price.toFixed(2)}\nCatalog price: $${originalPrice.toFixed(2)}\nDifference: +$${priceError.toFixed(2)} per unit\n\n🔴 Vendor may be using outdated pricing or attempting overcharge`;
      }
      break;
      
    case 'duplicate_charge':
      const dupItem = { ...invoiceLineItems[0] };
      invoiceLineItems.push(dupItem);
      invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
      invoiceTax = +(invoiceSubtotal * 0.08).toFixed(2);
      invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
      discrepancyNotes = `🚨 DUPLICATE CHARGE DETECTED\n\nItem: ${dupItem.name}\nSKU: ${dupItem.sku}\n\nThis item appears TWICE on the invoice!\nDuplicate charge amount: $${dupItem.total.toFixed(2)}\n\n🔴 CRITICAL: Possible billing system error or fraud attempt\nACTION: Contact vendor immediately for credit`;
      break;
      
    case 'missing_item':
      if (invoiceLineItems.length > 1) {
        const removedItem = invoiceLineItems.pop()!;
        invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
        invoiceTax = +(invoiceSubtotal * 0.08).toFixed(2);
        invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
        discrepancyNotes = `⚠️ MISSING ITEM ON INVOICE\n\nExpected but not found:\n• ${removedItem.name}\n• SKU: ${removedItem.sku}\n• Quantity: ${removedItem.quantity}\n• Value: $${removedItem.total.toFixed(2)}\n\n🔴 Invoice total is LOWER than order total\nACTION: Verify if item was shipped separately or if invoice is incomplete`;
      } else {
        invoiceTotal = +(invoiceTotal + 5.99).toFixed(2);
        discrepancyNotes = `⚠️ UNEXPLAINED FEE\n\nInvoice includes an unexplained $5.99 fee not present in the original order.\n\n🔴 ACTION: Request itemized breakdown from vendor`;
      }
      break;
      
    case 'wrong_sku':
      if (invoiceLineItems.length > 0) {
        const wrongProduct = randomChoice(PRODUCTS);
        const originalSku = invoiceLineItems[0].sku;
        const originalName = invoiceLineItems[0].name;
        invoiceLineItems[0].sku = wrongProduct.sku;
        invoiceLineItems[0].name = wrongProduct.name;
        invoiceLineItems[0].unit_price = wrongProduct.price;
        invoiceLineItems[0].total = +(wrongProduct.price * invoiceLineItems[0].quantity).toFixed(2);
        invoiceSubtotal = +invoiceLineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2);
        invoiceTax = +(invoiceSubtotal * 0.08).toFixed(2);
        invoiceTotal = +(invoiceSubtotal + invoiceTax + shipping).toFixed(2);
        discrepancyNotes = `⚠️ SKU/PRODUCT MISMATCH\n\nOrdered: ${originalName} (${originalSku})\nInvoiced: ${wrongProduct.name} (${wrongProduct.sku})\n\n🔴 Wrong product billed!\nACTION: Verify what was actually shipped to customer`;
      }
      break;
      
    case 'shipping_overcharge':
      const originalShipping = shipping;
      const newShipping = +(15.99 + Math.random() * 20).toFixed(2);
      invoiceTotal = +(invoiceSubtotal + invoiceTax + newShipping).toFixed(2);
      discrepancyNotes = `⚠️ SHIPPING OVERCHARGE\n\nOrder shipping: $${originalShipping.toFixed(2)}\nInvoice shipping: $${newShipping.toFixed(2)}\nOvercharge: $${(newShipping - originalShipping).toFixed(2)}\n\n🔴 Vendor charged premium shipping rate\nACTION: Verify shipping method used and request adjustment`;
      break;
      
    default:
      const roundingError = +(0.05 + Math.random() * 0.50).toFixed(2);
      invoiceTotal = +(invoiceTotal + roundingError).toFixed(2);
      discrepancyNotes = `⚠️ ROUNDING/CALCULATION ERROR\n\nInvoice Total: $${invoiceTotal.toFixed(2)}\nExpected Total: $${total.toFixed(2)}\nDifference: $${roundingError.toFixed(2)}\n\n🔴 Minor discrepancy but needs verification`;
  }

  const invoiceData = {
    invoice_id: invoiceId, 
    vendor_name: randomChoice(VENDORS), 
    line_items: invoiceLineItems,
    subtotal: invoiceSubtotal, 
    tax: invoiceTax, 
    total: invoiceTotal,
    invoice_date: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
    due_date: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    extraction_confidence: 0.60 + Math.random() * 0.25,
  };

  const rawPdfContent = `
INVOICE
=====================================
${invoiceData.vendor_name}
123 Commerce Way, Boston, MA 02101

Invoice #: ${invoiceId}
Date: ${invoiceData.invoice_date.toLocaleDateString()}

BILL TO: ${customer.name}

ITEMS:
${invoiceLineItems.map(item => `- ${item.sku} | ${item.name} | Qty: ${item.quantity} | $${item.total.toFixed(2)}`).join('\n')}

-------------------------------------
Subtotal: $${invoiceSubtotal.toFixed(2)}
Tax: $${invoiceTax.toFixed(2)}
-------------------------------------
TOTAL: $${invoiceTotal.toFixed(2)}
=====================================
`.trim();

  return {
    status: 'FLAGGED_FOR_REVIEW' as const,
    shopify_order_data: shopifyData,
    invoice_data: invoiceData,
    discrepancy_notes: discrepancyNotes,
    discrepancy_amount: +(invoiceTotal - total).toFixed(2),
    raw_pdf_content: rawPdfContent,
    audit_trail: [
      { action: 'SHOPIFY_ORDER_RECEIVED', timestamp: createdAt, actor: 'n8n:simulator', details: `Order #${orderNumber} received from Shopify` },
      { action: 'INVOICE_RECEIVED', timestamp: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000), actor: 'n8n:reconciler', details: `Invoice ${invoiceId} received via email` },
      { action: 'AI_EXTRACTION_COMPLETE', timestamp: new Date(createdAt.getTime() + 2.1 * 60 * 60 * 1000), actor: 'n8n:reconciler', details: `Data extracted with ${(invoiceData.extraction_confidence * 100).toFixed(0)}% confidence` },
      { action: 'FLAGGED_FOR_REVIEW', timestamp: new Date(createdAt.getTime() + 2.2 * 60 * 60 * 1000), actor: 'n8n:reconciler', details: '⚠️ DISCREPANCY DETECTED - Manual review required' }
    ],
    created_at: createdAt,
    updated_at: new Date(createdAt.getTime() + 2.2 * 60 * 60 * 1000),
    reconciled_at: null,
    reconciled_by: null,
  };
}

async function addErrorRecords() {
  console.log('🚨 Adding 150 Error Records to Finance Demo\n');
  
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB\n');

  const db = mongoose.connection.db;
  if (!db) throw new Error('DB not connected');
  
  const collection = db.collection('financial_reconciliations');

  console.log('Generating 150 error records...');
  const records = [];
  
  // Spread across last 72 hours with more recent bias
  for (let i = 0; i < 150; i++) {
    const hoursAgo = Math.floor(Math.pow(Math.random(), 1.5) * 72); // More recent bias
    records.push(generateFlaggedRecord(hoursAgo));
  }

  const result = await collection.insertMany(records);
  console.log(`✓ Inserted ${result.insertedCount} error records\n`);

  // Get updated counts
  const summary = await collection.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log('═══════════════════════════════════════');
  console.log('       UPDATED DATABASE TOTALS');
  console.log('═══════════════════════════════════════');
  let total = 0;
  summary.forEach((s: any) => {
    const icon = s._id === 'MATCHED' ? '✅' : s._id === 'FLAGGED_FOR_REVIEW' ? '🚨' : '⏳';
    console.log(`  ${icon} ${s._id.padEnd(20)} ${s.count.toLocaleString().padStart(6)}`);
    total += s.count;
  });
  console.log('───────────────────────────────────────');
  console.log(`     TOTAL: ${total.toLocaleString()} records`);
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('🎉 Done! Refresh dashboard to see error records.');
}

addErrorRecords();

