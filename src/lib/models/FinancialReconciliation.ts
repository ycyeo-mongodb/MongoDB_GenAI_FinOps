import mongoose, { Schema, Document, Model } from 'mongoose';
import type {
  ReconciliationStatus,
  LineItem,
  ShopifyOrderData,
  InvoiceData,
  AuditEntry,
} from '@/types';

// ============================================
// Financial Reconciliation Schema
// The "Bridge" between unstructured invoice data and ERP
// ============================================

// Sub-schemas for nested objects
const LineItemSchema = new Schema<LineItem>(
  {
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit_price: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const ShopifyOrderDataSchema = new Schema<ShopifyOrderData>(
  {
    order_id: { type: String, required: true, index: true },
    order_number: { type: String, required: true },
    customer_name: { type: String, required: true },
    customer_email: { type: String, required: true },
    line_items: { type: [LineItemSchema], required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    created_at: { type: Date, required: true },
    financial_status: { type: String, required: true },
    fulfillment_status: { type: String, default: null },
  },
  { _id: false }
);

const InvoiceDataSchema = new Schema<InvoiceData>(
  {
    invoice_id: { type: String, required: true, index: true },
    vendor_name: { type: String, required: true },
    line_items: { type: [LineItemSchema], required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    invoice_date: { type: Date, required: true },
    due_date: { type: Date, default: null },
    extraction_confidence: { type: Number, min: 0, max: 1, default: 0 },
  },
  { _id: false }
);

const AuditEntrySchema = new Schema<AuditEntry>(
  {
    action: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    actor: { type: String, required: true },
    details: { type: String },
  },
  { _id: false }
);

// Main Document Interface
export interface IFinancialReconciliation extends Document {
  status: ReconciliationStatus;
  shopify_order_data: ShopifyOrderData | null;
  invoice_data: InvoiceData | null;
  discrepancy_notes: string | null;
  discrepancy_amount: number | null;
  raw_pdf_content: string | null;
  audit_trail: AuditEntry[];
  created_at: Date;
  updated_at: Date;
  reconciled_at: Date | null;
  reconciled_by: string | null;
  // Vector embedding for RAG search
  embedding: number[] | null;
  embedding_text: string | null;
}

// Main Schema
const FinancialReconciliationSchema = new Schema<IFinancialReconciliation>(
  {
    status: {
      type: String,
      enum: ['PENDING', 'MATCHED', 'FLAGGED_FOR_REVIEW'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    shopify_order_data: {
      type: ShopifyOrderDataSchema,
      default: null,
    },
    invoice_data: {
      type: InvoiceDataSchema,
      default: null,
    },
    discrepancy_notes: {
      type: String,
      default: null,
    },
    discrepancy_amount: {
      type: Number,
      default: null,
    },
    raw_pdf_content: {
      type: String,
      default: null,
    },
    audit_trail: {
      type: [AuditEntrySchema],
      default: [],
    },
    reconciled_at: {
      type: Date,
      default: null,
    },
    reconciled_by: {
      type: String,
      default: null,
    },
    // Vector embedding for RAG search (1024 dimensions for Voyage AI voyage-4)
    embedding: {
      type: [Number],
      default: null,
    },
    embedding_text: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    collection: 'financial_reconciliations',
  }
);

// Compound indexes for common queries
FinancialReconciliationSchema.index({ status: 1, created_at: -1 });
FinancialReconciliationSchema.index({ 'shopify_order_data.order_id': 1 });
FinancialReconciliationSchema.index({ 'invoice_data.invoice_id': 1 });

// Virtual for quick amount comparison
FinancialReconciliationSchema.virtual('amounts_match').get(function () {
  if (!this.shopify_order_data || !this.invoice_data) return null;
  return Math.abs(this.shopify_order_data.total - this.invoice_data.total) < 0.01;
});

// Pre-save hook to calculate discrepancy
FinancialReconciliationSchema.pre('save', function (next) {
  if (this.shopify_order_data && this.invoice_data) {
    const diff = this.invoice_data.total - this.shopify_order_data.total;
    this.discrepancy_amount = Math.round(diff * 100) / 100;
  }
  next();
});

// Static method to find by Shopify Order ID
FinancialReconciliationSchema.statics.findByShopifyOrderId = function (
  orderId: string
) {
  return this.findOne({ 'shopify_order_data.order_id': orderId });
};

// Model export with type safety
const FinancialReconciliation: Model<IFinancialReconciliation> =
  mongoose.models.FinancialReconciliation ||
  mongoose.model<IFinancialReconciliation>(
    'FinancialReconciliation',
    FinancialReconciliationSchema
  );

export default FinancialReconciliation;

