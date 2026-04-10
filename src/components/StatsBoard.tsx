'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
  FileStack,
} from 'lucide-react';

interface Stats {
  total_today: number;
  total_matched: number;
  total_flagged: number;
  total_pending: number;
  match_rate: number;
  avg_processing_time_ms: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant: 'default' | 'success' | 'danger' | 'warning';
  filterKey?: string;
  isActive?: boolean;
  onClick?: (filterKey: string | null) => void;
}

function StatCard({ title, value, subtitle, icon, variant, filterKey, isActive, onClick }: StatCardProps) {
  const variantStyles = {
    default: 'border-mdb-border',
    success: 'border-emerald-200',
    danger: 'border-red-200',
    warning: 'border-amber-200',
  };
  const activeRing = {
    default: 'ring-2 ring-mdb-green/40',
    success: 'ring-2 ring-emerald-400/40',
    danger: 'ring-2 ring-red-400/40',
    warning: 'ring-2 ring-amber-400/40',
  };
  const iconColors = {
    default: 'text-mdb-muted bg-gray-100',
    success: 'text-emerald-600 bg-emerald-50',
    danger: 'text-red-600 bg-red-50',
    warning: 'text-amber-600 bg-amber-50',
  };

  const isClickable = !!filterKey && !!onClick;

  return (
    <div
      className={`bg-white rounded-xl p-5 border ${variantStyles[variant]} transition-all
        ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}
        ${isActive ? activeRing[variant] : ''}`}
      onClick={() => isClickable && onClick(isActive ? null : filterKey)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-mdb-muted uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-3xl font-bold font-tabular text-mdb-dark">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-mdb-muted">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${iconColors[variant]}`}>
          {icon}
        </div>
      </div>
      {isClickable && (
        <p className="mt-2 text-xs text-mdb-muted">
          {isActive ? 'Click to clear filter' : 'Click to filter'}
        </p>
      )}
    </div>
  );
}

interface StatsBoardProps {
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

export default function StatsBoard({ activeFilter, onFilterChange }: StatsBoardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/reconciliation/stats');
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-mdb-border animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard title="Processed" value={stats.total_today} subtitle="Invoices ingested"
        icon={<FileStack size={22} />} variant="default" filterKey="ALL"
        isActive={activeFilter === 'ALL'} onClick={onFilterChange} />
      <StatCard title="Auto-Reconciled" value={stats.total_matched} subtitle="Ready for ERP"
        icon={<CheckCircle size={22} />} variant="success" filterKey="MATCHED"
        isActive={activeFilter === 'MATCHED'} onClick={onFilterChange} />
      <StatCard title="Requires Review" value={stats.total_flagged} subtitle="Manual attention needed"
        icon={<AlertTriangle size={22} />} variant="danger" filterKey="FLAGGED_FOR_REVIEW"
        isActive={activeFilter === 'FLAGGED_FOR_REVIEW'} onClick={onFilterChange} />
      <StatCard title="Pending" value={stats.total_pending} subtitle="Awaiting invoice"
        icon={<Clock size={22} />} variant="warning" filterKey="PENDING"
        isActive={activeFilter === 'PENDING'} onClick={onFilterChange} />
      <StatCard title="Match Rate" value={`${stats.match_rate}%`} subtitle="Automation accuracy"
        icon={<TrendingUp size={22} />} variant={stats.match_rate >= 80 ? 'success' : 'warning'} />
      <StatCard title="Avg. Processing" value={`${(stats.avg_processing_time_ms / 1000).toFixed(1)}s`}
        subtitle="Per invoice" icon={<Zap size={22} />} variant="default" />
    </div>
  );
}
