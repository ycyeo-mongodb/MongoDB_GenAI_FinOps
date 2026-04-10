'use client';

import { useState, useEffect, useRef } from 'react';

interface Source { invoice_id: string | null; vendor: string | null; total: number | null; score: number | string; match_type: string; }
interface MongoDBFeatures { atlas_search: boolean; vector_search: boolean; hybrid: boolean; }
interface Message { role: 'user' | 'assistant'; content: string; sources?: Source[]; searchMethods?: string[]; mongodbFeatures?: MongoDBFeatures; }

export default function RAGSearchPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [docCount, setDocCount] = useState<{ total: number; embedded: number }>({ total: 0, embedded: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/rag/status').then(r => r.json()).then(d => {
      if (d.total !== undefined) setDocCount({ total: d.total, embedded: d.embedded });
    }).catch(() => {});
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    const q = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setIsLoading(true);
    try {
      const res = await fetch('/api/rag/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, topK: 5 }) });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.success ? data.answer : 'Error processing request.', sources: data.sources, searchMethods: data.search_methods, mongodbFeatures: data.mongodb_features }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally { setIsLoading(false); }
  };

  const sampleQuestions = [
    "What is the highest invoice total?",
    "Show invoices from Amanda Williams",
    "Which invoices are flagged for review?",
    "List all matched invoices over $1000",
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="border-b border-mdb-border bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-mdb-dark">Invoice AI Assistant</h1>
            <p className="text-sm text-mdb-muted">Hybrid Search: Atlas Search + Vector Search + Claude RAG</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="text-mdb-green font-medium">{docCount.embedded} docs indexed</p>
              <p className="text-xs text-mdb-muted">MongoDB Atlas + Voyage AI</p>
            </div>
            <a href="/" className="px-4 py-2 text-sm border border-mdb-border rounded-lg text-mdb-dark hover:bg-gray-50 transition-colors">
              Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Pipeline Diagram */}
      <div className="max-w-4xl mx-auto px-6 pt-6 w-full">
        <div className="p-4 bg-white rounded-xl border border-mdb-border">
          <div className="flex items-center justify-center gap-4 text-sm">
            {[
              { icon: '💬', label: 'Query', color: 'bg-mdb-green' },
              { icon: '🔢', label: 'Voyage AI', color: 'bg-blue-600' },
              { icon: '🍃', label: 'MongoDB', color: 'bg-mdb-green' },
              { icon: '📄', label: 'Top-K Docs', color: 'bg-amber-600' },
              { icon: '🤖', label: 'Claude', color: 'bg-purple-600' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-lg ${step.color} flex items-center justify-center text-white text-lg`}>{step.icon}</div>
                  <span className="mt-1 text-xs text-mdb-muted">{step.label}</span>
                </div>
                {i < 4 && <span className="text-gray-300 text-lg mt-[-16px]">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-6 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-mdb-dark mb-2">Ask about your invoices</h2>
              <p className="text-mdb-muted mb-6">I can find specific invoices by ID or answer questions about your data</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {sampleQuestions.map((q, idx) => (
                  <button key={idx} onClick={() => setInput(q)}
                    className="px-3 py-2 text-sm bg-white hover:bg-gray-50 border border-mdb-border rounded-lg text-mdb-dark transition-colors">
                    {q}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-center gap-3 text-sm">
                <span className="px-2 py-1 bg-mdb-green-bg text-mdb-green rounded">MongoDB Atlas</span>
                <span className="text-gray-300">+</span>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">Voyage AI</span>
                <span className="text-gray-300">+</span>
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded">Claude</span>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%]">
                  <div className={`px-4 py-3 rounded-2xl ${
                    msg.role === 'user' ? 'bg-mdb-green text-white' : 'bg-white border border-mdb-border text-mdb-dark'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 px-2">
                      {msg.mongodbFeatures && (
                        <div className="flex items-center gap-2 text-xs mb-2">
                          <span className="text-mdb-muted">MongoDB:</span>
                          {msg.mongodbFeatures.atlas_search && <span className="px-2 py-0.5 bg-mdb-green-bg text-mdb-green rounded border border-emerald-200">Atlas Search</span>}
                          {msg.mongodbFeatures.vector_search && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">Vector Search</span>}
                          {msg.mongodbFeatures.hybrid && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">Hybrid</span>}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.slice(0, 4).map((src, i) => (
                          <span key={i} className={`px-2 py-1 text-xs rounded ${
                            src.match_type === 'atlas_search' ? 'bg-mdb-green-bg text-mdb-green border border-emerald-200'
                            : src.match_type === 'vector_search' ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-gray-100 text-mdb-muted'
                          }`}>
                            {src.invoice_id} {src.match_type === 'atlas_search' ? `(${src.score})` : `(${src.score}%)`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-mdb-border px-4 py-3 rounded-2xl flex items-center gap-2 text-mdb-muted">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-mdb-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-mdb-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-mdb-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm">Searching invoices...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-mdb-border pt-4">
          <div className="flex gap-3">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder="Ask about invoices..."
              className="flex-1 px-4 py-3 bg-white border border-mdb-border rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-mdb-green/30 focus:border-mdb-green"
              disabled={isLoading} />
            <button onClick={handleSubmit} disabled={isLoading || !input.trim()}
              className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                isLoading || !input.trim() ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-mdb-green hover:bg-mdb-green/90 text-white'
              }`}>
              {isLoading ? '...' : 'Ask'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
