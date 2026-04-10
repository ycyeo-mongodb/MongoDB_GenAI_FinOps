'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, RefreshCw, Filter, Search, X } from 'lucide-react';

interface ReconciliationItem {
  _id: string;
  status: 'PENDING' | 'MATCHED' | 'FLAGGED_FOR_REVIEW';
  shopify_order_data?: { order_id: string; order_number: string; total: number; customer_name: string };
  invoice_data?: { invoice_id: string; total: number; vendor_name: string };
  discrepancy_amount: number | null;
  created_at: string;
  amounts_match?: boolean | null;
}

interface DataGridProps {
  onSelectRow: (id: string) => void;
  selectedId: string | null;
  externalFilter?: string | null;
  onClearFilter?: () => void;
}

export default function DataGrid({ onSelectRow, selectedId, externalFilter, onClearFilter }: DataGridProps) {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pipelineInfo, setPipelineInfo] = useState<any>(null);
  const limit = 15;
  const statusFilter = externalFilter || '';

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await fetch(`/api/reconciliation/list?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setPipelineInfo(data._pipeline_info);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [externalFilter]);
  useEffect(() => {
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalPages = Math.ceil(total / limit);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      MATCHED: 'status-matched',
      FLAGGED_FOR_REVIEW: 'status-flagged',
      PENDING: 'status-pending',
    };
    const labels: Record<string, string> = { MATCHED: 'Matched', FLAGGED_FOR_REVIEW: 'Review', PENDING: 'Pending' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getRowClass = (item: ReconciliationItem) => {
    const base = 'cursor-pointer transition-colors hover:bg-gray-50';
    const selected = selectedId === item._id ? 'bg-mdb-green-bg ring-1 ring-mdb-green/30' : '';
    const border = item.status === 'FLAGGED_FOR_REVIEW' ? 'row-flagged' :
                   item.status === 'MATCHED' ? 'row-matched' : 'row-pending';
    return `${base} ${selected} ${border}`;
  };

  const filterLabels: Record<string, string> = {
    ALL: 'All Records', MATCHED: 'Auto-Reconciled',
    FLAGGED_FOR_REVIEW: 'Requires Review', PENDING: 'Pending',
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-mdb-border overflow-hidden">
        <div className="p-6 space-y-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-mdb-border overflow-hidden">
      <div className="px-6 py-4 border-b border-mdb-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-mdb-dark">Reconciliation Queue</h2>
          <div className="flex items-center gap-1.5 text-xs text-mdb-muted">
            <div className="w-2 h-2 rounded-full bg-mdb-green animate-pulse" />
            Live
          </div>
        </div>
        <div className="flex items-center gap-2">
          {externalFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-mdb-green-bg border border-emerald-200 rounded-lg">
              <Filter size={14} className="text-mdb-green" />
              <span className="text-sm text-mdb-green font-medium">{filterLabels[externalFilter] || externalFilter}</span>
              {onClearFilter && (
                <button onClick={onClearFilter} className="p-0.5 hover:bg-emerald-100 rounded">
                  <X size={14} className="text-mdb-green" />
                </button>
              )}
            </div>
          )}
          <button onClick={fetchData} disabled={refreshing}
            className="p-2 rounded-lg bg-white border border-mdb-border text-mdb-muted hover:text-mdb-dark hover:border-gray-300 transition-colors disabled:opacity-50">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {pipelineInfo && externalFilter && (
        <div className="px-6 py-2 bg-gray-50 border-b border-mdb-border flex items-center gap-3 text-xs">
          <span className="text-mdb-muted">MongoDB Pipeline:</span>
          {pipelineInfo.stages_used.map((stage: string, i: number) => (
            <span key={stage} className="flex items-center gap-1">
              <code className="px-1.5 py-0.5 bg-mdb-green-bg text-mdb-green rounded font-mono">{stage}</code>
              {i < pipelineInfo.stages_used.length - 1 && <span className="text-gray-300">→</span>}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {['Date', 'Invoice ID', 'Order Amount', 'Invoice Amount', 'Diff', 'Status'].map((h, i) => (
                <th key={h} className={`px-6 py-3 text-xs font-semibold text-mdb-muted uppercase tracking-wider ${i >= 2 && i <= 4 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-mdb-border">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-mdb-muted">
                  <Search size={32} className="mx-auto mb-3 opacity-30" />
                  <p>No reconciliations found</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id} onClick={() => onSelectRow(item._id)} className={getRowClass(item)}>
                  <td className="px-6 py-3.5 text-sm text-mdb-muted whitespace-nowrap">
                    {format(new Date(item.created_at), 'MMM dd, HH:mm')}
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <span className="text-sm font-mono text-mdb-green font-medium">
                      {item.invoice_data?.invoice_id || item.shopify_order_data?.order_number || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right font-tabular text-sm">{formatCurrency(item.shopify_order_data?.total)}</td>
                  <td className="px-6 py-3.5 text-right font-tabular text-sm">{formatCurrency(item.invoice_data?.total)}</td>
                  <td className="px-6 py-3.5 text-right font-tabular text-sm">
                    {item.discrepancy_amount !== null && item.discrepancy_amount !== 0 ? (
                      <span className={item.discrepancy_amount > 0 ? 'text-red-600' : 'text-mdb-green'}>
                        {item.discrepancy_amount > 0 ? '+' : ''}{formatCurrency(item.discrepancy_amount)}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-3.5 text-center whitespace-nowrap">{getStatusBadge(item.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-mdb-border flex items-center justify-between">
        <p className="text-sm text-mdb-muted">
          Showing <span className="font-medium text-mdb-dark">{items.length > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
          <span className="font-medium text-mdb-dark">{Math.min(page * limit, total)}</span> of{' '}
          <span className="font-medium text-mdb-dark">{total}</span>
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg border border-mdb-border text-mdb-muted hover:text-mdb-dark disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 py-1 text-sm text-mdb-muted">Page {page} of {totalPages || 1}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="p-2 rounded-lg border border-mdb-border text-mdb-muted hover:text-mdb-dark disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
