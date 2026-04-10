// ============================================
// Financial Reconciliation Types
// GenAI Finance Automation Demo
// ============================================

export type ReconciliationStatus = 'PENDING' | 'MATCHED' | 'FLAGGED_FOR_REVIEW';

export interface LineItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ShopifyOrderData {
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
}

export interface InvoiceData {
  invoice_id: string;
  vendor_name: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  invoice_date: Date;
  due_date: Date | null;
  extraction_confidence: number; // 0-1 confidence score from AI
}

export interface AuditEntry {
  action: string;
  timestamp: Date;
  actor: string; // 'SYSTEM' | 'n8n' | 'USER:<email>'
  details?: string;
}

export interface FinancialReconciliation {
  _id?: string;
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
}

// API Response Types
export interface StatsResponse {
  total_today: number;
  total_matched: number;
  total_flagged: number;
  total_pending: number;
  match_rate: number;
  avg_processing_time_ms: number;
}

export interface ReconciliationListItem {
  _id: string;
  status: ReconciliationStatus;
  shopify_order_id: string | null;
  invoice_id: string | null;
  shopify_amount: number | null;
  invoice_amount: number | null;
  discrepancy_amount: number | null;
  created_at: Date;
}

export interface ReconciliationListResponse {
  items: ReconciliationListItem[];
  total: number;
  page: number;
  limit: number;
}

