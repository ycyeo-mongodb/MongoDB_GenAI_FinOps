'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { X, ShoppingCart, FileText, AlertTriangle, CheckCircle, Clock, User, Mail, Package, DollarSign, Calendar, History, Loader2, CheckCheck } from 'lucide-react';

interface LineItem { sku: string; name: string; quantity: number; unit_price: number; total: number; }

interface ReconciliationDetail {
  _id: string;
  status: 'PENDING' | 'MATCHED' | 'FLAGGED_FOR_REVIEW';
  shopify_order_data: {
    order_id: string; order_number: string; customer_name: string; customer_email: string;
    line_items: LineItem[]; subtotal: number; tax: number; shipping: number; total: number;
    currency: string; created_at: string; financial_status: string; fulfillment_status: string | null;
  } | null;
  invoice_data: {
    invoice_id: string; vendor_name: string; line_items: LineItem[];
    subtotal: number; tax: number; total: number; invoice_date: string;
    due_date: string | null; extraction_confidence: number;
  } | null;
  discrepancy_notes: string | null;
  discrepancy_amount: number | null;
  raw_pdf_content: string | null;
  audit_trail: { action: string; timestamp: string; actor: string; details?: string }[];
  created_at: string; updated_at: string; reconciled_at: string | null; reconciled_by: string | null;
}

interface DetailViewProps { id: string | null; onClose: () => void; onReconciled: () => void; }

export default function DetailView({ id, onClose, onReconciled }: DetailViewProps) {
  const [data, setData] = useState<ReconciliationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [forceReconciling, setForceReconciling] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) { setData(null); return; }
    async function fetchDetail() {
      setLoading(true);
      try {
        const res = await fetch(`/api/reconciliation/${id}`);
        setData(await res.json());
      } catch (error) { console.error('Failed to fetch detail:', error); }
      finally { setLoading(false); }
    }
    fetchDetail();
  }, [id]);

  const handleForceReconcile = async () => {
    if (!id) return;
    setForceReconciling(true);
    try {
      const res = await fetch('/api/reconciliation/force-reconcile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user_email: 'cfo@company.com', notes: notes || undefined }),
      });
      if (res.ok) {
        onReconciled();
        const updated = await fetch(`/api/reconciliation/${id}`);
        setData(await updated.json());
        setNotes('');
      }
    } catch (error) { console.error('Failed to force reconcile:', error); }
    finally { setForceReconciling(false); }
  };

  const fmt = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (!id) {
    return (
      <div className="bg-white rounded-xl border border-mdb-border h-full flex items-center justify-center text-mdb-muted">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">Select a record to view details</p>
          <p className="text-sm mt-1">Click on any row in the table</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="bg-white rounded-xl border border-mdb-border h-full flex items-center justify-center"><Loader2 size={32} className="animate-spin text-mdb-green" /></div>;
  if (!data) return <div className="bg-white rounded-xl border border-mdb-border h-full flex items-center justify-center text-red-500">Failed to load details</div>;

  const StatusIcon = { MATCHED: CheckCircle, FLAGGED_FOR_REVIEW: AlertTriangle, PENDING: Clock }[data.status];
  const statusColor = { MATCHED: 'text-emerald-600', FLAGGED_FOR_REVIEW: 'text-red-600', PENDING: 'text-amber-600' }[data.status];

  return (
    <div className="bg-white rounded-xl border border-mdb-border h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-mdb-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <StatusIcon size={22} className={statusColor} />
          <div>
            <h2 className="text-lg font-semibold text-mdb-dark">{data.invoice_data?.invoice_id || data.shopify_order_data?.order_id || 'Unknown'}</h2>
            <p className="text-xs text-mdb-muted">Created {format(new Date(data.created_at), 'MMM dd, yyyy HH:mm')}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-mdb-muted"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 divide-x divide-mdb-border">
          {/* Shopify Order */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart size={16} className="text-mdb-green" />
              <h3 className="text-sm font-semibold text-mdb-dark uppercase tracking-wider">Shopify Order</h3>
            </div>
            {data.shopify_order_data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-mdb-muted">Order #</p>
                    <p className="text-sm font-mono text-mdb-green mt-1">{data.shopify_order_data.order_number}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-mdb-muted">Date</p>
                    <p className="text-sm mt-1">{format(new Date(data.shopify_order_data.created_at), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-mdb-muted mb-1">Customer</p>
                  <p className="text-sm font-medium">{data.shopify_order_data.customer_name}</p>
                  <p className="text-xs text-mdb-muted mt-0.5">{data.shopify_order_data.customer_email}</p>
                </div>
                <div>
                  <p className="text-xs text-mdb-muted mb-2">Line Items</p>
                  {data.shopify_order_data.line_items.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded p-2 mb-1 flex justify-between items-center">
                      <div>
                        <p className="text-sm">{item.name}</p>
                        <p className="text-xs text-mdb-muted">SKU: {item.sku} x {item.quantity}</p>
                      </div>
                      <p className="text-sm font-tabular">{fmt(item.total)}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-mdb-border pt-3 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-mdb-muted">Subtotal</span><span className="font-tabular">{fmt(data.shopify_order_data.subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-mdb-muted">Tax</span><span className="font-tabular">{fmt(data.shopify_order_data.tax)}</span></div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-mdb-border">
                    <span>Total</span><span className="font-tabular text-mdb-green">{fmt(data.shopify_order_data.total)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-mdb-muted"><ShoppingCart size={32} className="mx-auto mb-2 opacity-20" /><p>No Shopify data</p></div>
            )}
          </div>

          {/* Invoice */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={16} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-mdb-dark uppercase tracking-wider">Extracted Invoice</h3>
              {data.invoice_data && (
                <span className="ml-auto text-xs bg-gray-100 px-2 py-0.5 rounded text-mdb-muted">
                  {Math.round(data.invoice_data.extraction_confidence * 100)}% confidence
                </span>
              )}
            </div>
            {data.invoice_data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-mdb-muted">Invoice #</p>
                    <p className="text-sm font-mono text-amber-600 mt-1">{data.invoice_data.invoice_id}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-mdb-muted">Date</p>
                    <p className="text-sm mt-1">{format(new Date(data.invoice_data.invoice_date), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-mdb-muted mb-1">Vendor</p>
                  <p className="text-sm font-medium">{data.invoice_data.vendor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-mdb-muted mb-2">Line Items</p>
                  {data.invoice_data.line_items.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded p-2 mb-1 flex justify-between items-center">
                      <div><p className="text-sm">{item.name}</p><p className="text-xs text-mdb-muted">SKU: {item.sku} x {item.quantity}</p></div>
                      <p className="text-sm font-tabular">{fmt(item.total)}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-mdb-border pt-3 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-mdb-muted">Subtotal</span><span className="font-tabular">{fmt(data.invoice_data.subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-mdb-muted">Tax</span><span className="font-tabular">{fmt(data.invoice_data.tax)}</span></div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-mdb-border">
                    <span>Total</span>
                    <span className={`font-tabular ${data.discrepancy_amount && data.discrepancy_amount !== 0 ? 'text-red-600' : 'text-mdb-green'}`}>
                      {fmt(data.invoice_data.total)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-mdb-muted"><FileText size={32} className="mx-auto mb-2 opacity-20" /><p>No invoice data</p></div>
            )}

            {data.discrepancy_amount !== null && data.discrepancy_amount !== 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 mb-1">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-semibold">Discrepancy Detected</span>
                </div>
                <p className="text-sm">Difference: <span className="font-tabular font-semibold text-red-600">{fmt(data.discrepancy_amount)}</span></p>
                {data.discrepancy_notes && <p className="text-xs text-mdb-muted mt-1">{data.discrepancy_notes}</p>}
              </div>
            )}
          </div>
        </div>

        {data.audit_trail.length > 0 && (
          <div className="px-5 py-4 border-t border-mdb-border">
            <div className="flex items-center gap-2 mb-3">
              <History size={16} className="text-mdb-muted" />
              <h3 className="text-sm font-semibold text-mdb-muted uppercase tracking-wider">Audit Trail</h3>
            </div>
            <div className="space-y-1.5">
              {data.audit_trail.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm bg-gray-50 rounded p-2">
                  <span className="text-xs text-mdb-muted shrink-0 pt-0.5 font-mono">{format(new Date(entry.timestamp), 'HH:mm:ss')}</span>
                  <div>
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-mdb-muted mx-1">by</span>
                    <span className="text-mdb-green font-medium">{entry.actor}</span>
                    {entry.details && <p className="text-xs text-mdb-muted mt-0.5">{entry.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {data.status === 'FLAGGED_FOR_REVIEW' && (
        <div className="px-5 py-4 border-t border-mdb-border shrink-0 bg-gray-50">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Override notes (optional)..."
            className="w-full px-3 py-2 bg-white border border-mdb-border rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-mdb-green/30 resize-none mb-3" rows={2} />
          <button onClick={handleForceReconcile} disabled={forceReconciling}
            className="w-full py-2.5 bg-mdb-green hover:bg-mdb-green/90 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {forceReconciling ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <><CheckCheck size={18} /> Force Reconcile</>}
          </button>
        </div>
      )}

      {data.status === 'MATCHED' && data.reconciled_by && (
        <div className="px-5 py-3 border-t border-mdb-border shrink-0 bg-mdb-green-bg">
          <div className="flex items-center gap-2 text-mdb-green text-sm">
            <CheckCircle size={16} />
            <span>Reconciled {data.reconciled_at && format(new Date(data.reconciled_at), "MMM dd 'at' HH:mm")} by {data.reconciled_by}</span>
          </div>
        </div>
      )}
    </div>
  );
}
