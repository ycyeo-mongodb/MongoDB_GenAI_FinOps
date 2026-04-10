'use client';

import { useState, useCallback } from 'react';
import StatsBoard from '@/components/StatsBoard';
import DataGrid from '@/components/DataGrid';
import DetailView from '@/components/DetailView';

export default function Dashboard() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const handleReconciled = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleFilterChange = useCallback((filter: string | null) => {
    setStatusFilter(filter);
    setSelectedId(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-mdb-border shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="#00684A"/>
                  <path d="M16.5 7C16.5 7 20.5 10.5 20.5 15.5C20.5 20.5 16.5 24 16.5 24C16.5 24 12.5 20.5 12.5 15.5C12.5 10.5 16.5 7 16.5 7Z" fill="white"/>
                </svg>
                <div>
                  <h1 className="text-lg font-semibold text-mdb-dark">
                    Finance Operations
                  </h1>
                  <p className="text-xs text-mdb-muted">
                    MongoDB Workshop — Reconciliation Dashboard
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/ragsearch"
                className="px-4 py-2 text-sm bg-mdb-green hover:bg-mdb-green/90 rounded-lg text-white font-medium transition-colors"
              >
                RAG Search
              </a>
              <a
                href="/imagegenaidemo"
                className="px-4 py-2 text-sm bg-white hover:bg-gray-50 border border-mdb-border rounded-lg text-mdb-dark font-medium transition-colors"
              >
                AI Extraction
              </a>
              <div className="w-px h-8 bg-mdb-border" />
              <div className="text-right">
                <p className="text-sm font-medium text-mdb-dark">CFO Portal</p>
                <p className="text-xs text-mdb-muted">MongoDB Atlas</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        <section key={`stats-${refreshKey}`}>
          <StatsBoard
            activeFilter={statusFilter}
            onFilterChange={handleFilterChange}
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-5 gap-6" style={{ minHeight: '600px' }}>
          <div className="xl:col-span-3">
            <DataGrid
              key={`grid-${refreshKey}`}
              onSelectRow={setSelectedId}
              selectedId={selectedId}
              externalFilter={statusFilter}
              onClearFilter={() => setStatusFilter(null)}
            />
          </div>
          <div className="xl:col-span-2">
            <DetailView
              id={selectedId}
              onClose={() => setSelectedId(null)}
              onReconciled={handleReconciled}
            />
          </div>
        </section>

        <footer className="border-t border-mdb-border pt-6 pb-8">
          <div className="flex items-center justify-between text-sm text-mdb-muted">
            <div className="flex items-center gap-4">
              <span>Powered by MongoDB Atlas + Amazon Bedrock + Voyage AI</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-mdb-green" />
                All systems operational
              </span>
            </div>
            <span>MongoDB Workshop Demo</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
