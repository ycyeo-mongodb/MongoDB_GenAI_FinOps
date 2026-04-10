'use client';

import { useState, useRef } from 'react';

interface ExtractedData {
  invoice_id: string | null; order_number: string | null; vendor_name: string | null;
  customer_name: string | null; line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  subtotal: number | null; discount: number | null; tax: number | null; total: number | null;
  invoice_date: string | null; due_date: string | null;
}

interface APIResponse { success: boolean; data?: ExtractedData; extraction_type?: string; model?: string; error?: string; }

export default function ImageGenAIDemo() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<APIResponse | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; invoice_id?: string; embedded?: boolean; message?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setSelectedImage(e.target?.result as string);
      reader.readAsDataURL(file);
      setExtractedData(null); setError(null); setApiResponse(null); setSaveResult(null);
    }
  };

  const loadSampleImage = async (imageName: string) => {
    try {
      const response = await fetch(`/api/sample-image?name=${imageName}`);
      const data = await response.json();
      if (data.success) {
        setSelectedImage(`data:${data.media_type};base64,${data.image_base64}`);
        setImageFile(null); setExtractedData(null); setError(null); setApiResponse(null); setSaveResult(null);
      }
    } catch { setError('Failed to load sample image'); }
  };

  const extractInvoiceData = async () => {
    if (!selectedImage) return;
    setIsExtracting(true); setError(null); setExtractedData(null);
    try {
      const base64Match = selectedImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) throw new Error('Invalid image format');
      const result: APIResponse = await fetch('/api/extract-invoice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64Match[2], media_type: base64Match[1] }),
      }).then(r => r.json());
      setApiResponse(result);
      if (result.success && result.data) setExtractedData(result.data);
      else setError(result.error || 'Extraction failed');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to extract data'); }
    finally { setIsExtracting(false); }
  };

  const saveToMongoDB = async () => {
    if (!extractedData) return;
    setIsSaving(true); setSaveResult(null);
    try {
      const result = await fetch('/api/reconciliation/save-extraction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted_data: extractedData, raw_image_base64: selectedImage }),
      }).then(r => r.json());
      setSaveResult({ success: result.success, invoice_id: result.invoice_id, embedded: result.embedded, message: result.message || result.error || 'Failed to save' });
    } catch { setSaveResult({ success: false, message: 'Failed to save to MongoDB' }); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-mdb-border bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-mdb-dark">AI Invoice Extraction</h1>
            <p className="text-sm text-mdb-muted">Powered by Amazon Bedrock (Claude Vision) + MongoDB</p>
          </div>
          <a href="/" className="px-4 py-2 text-sm border border-mdb-border rounded-lg text-mdb-dark hover:bg-gray-50 transition-colors">
            Back to Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Pipeline Diagram */}
        <div className="mb-8 p-5 bg-white rounded-xl border border-mdb-border">
          <h2 className="text-sm font-semibold text-mdb-muted mb-4 uppercase tracking-wider">Architecture Flow</h2>
          <div className="flex items-center justify-center gap-4 text-sm">
            {[
              { icon: '📄', label: 'Invoice Image', sub: 'PNG/JPG', color: 'bg-blue-600' },
              { icon: '🤖', label: 'Bedrock Claude', sub: 'Vision AI', color: 'bg-purple-600' },
              { icon: '📦', label: 'Structured JSON', sub: 'Extracted Data', color: 'bg-amber-600' },
              { icon: '🍃', label: 'MongoDB Atlas', sub: 'Store & Index', color: 'bg-mdb-green' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex flex-col items-center min-w-[100px]">
                  <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center text-xl text-white`}>{step.icon}</div>
                  <span className="mt-2 text-sm font-medium">{step.label}</span>
                  <span className="text-xs text-mdb-muted">{step.sub}</span>
                </div>
                {i < 3 && <span className="text-gray-300 text-xl mt-[-20px]">→</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Panel */}
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-xl border border-mdb-border">
              <h2 className="text-lg font-semibold text-mdb-dark mb-4">Upload Invoice Image</h2>
              <div className="mb-4">
                <p className="text-sm text-mdb-muted mb-2">Or try sample images:</p>
                <div className="flex gap-2">
                  <button onClick={() => loadSampleImage('test.png')} className="px-3 py-1.5 text-xs bg-mdb-green-bg hover:bg-emerald-100 border border-emerald-200 rounded-lg text-mdb-green transition-colors">Sample 1 (test.png)</button>
                  <button onClick={() => loadSampleImage('excel-invoice-template.png')} className="px-3 py-1.5 text-xs bg-mdb-green-bg hover:bg-emerald-100 border border-emerald-200 rounded-lg text-mdb-green transition-colors">Sample 2 (Excel Template)</button>
                </div>
              </div>
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-mdb-border rounded-xl p-8 text-center cursor-pointer hover:border-mdb-green hover:bg-mdb-green-bg/30 transition-all">
                {selectedImage ? (
                  <img src={selectedImage} alt="Selected invoice" className="max-h-80 mx-auto rounded-lg shadow-sm" />
                ) : (
                  <div className="text-mdb-muted">
                    <p className="text-4xl mb-3 opacity-30">📁</p>
                    <p>Click to upload an invoice image</p>
                    <p className="text-sm mt-1">PNG, JPG up to 5MB</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleImageSelect} className="hidden" />
              <button onClick={extractInvoiceData} disabled={!selectedImage || isExtracting}
                className={`w-full mt-4 py-3 rounded-xl font-semibold text-white transition-colors ${!selectedImage || isExtracting ? 'bg-gray-300 cursor-not-allowed' : 'bg-mdb-green hover:bg-mdb-green/90'}`}>
                {isExtracting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Extracting with Claude AI...
                  </span>
                ) : 'Extract Invoice Data with AI'}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>}
            {extractedData && (
              <>
                <div className="p-6 bg-white rounded-xl border border-mdb-border">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-mdb-dark">Extracted Data</h2>
                    <span className="px-2 py-1 text-xs bg-mdb-green-bg text-mdb-green rounded">{apiResponse?.model?.split('/').pop()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      ['Invoice ID', extractedData.invoice_id],
                      ['Order Number', extractedData.order_number],
                      ['Vendor', extractedData.vendor_name],
                      ['Customer', extractedData.customer_name],
                      ['Invoice Date', extractedData.invoice_date],
                      ['Due Date', extractedData.due_date],
                    ].map(([label, value]) => (
                      <div key={label as string} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-mdb-muted">{label}</p>
                        <p className="text-sm font-medium mt-0.5">{(value as string) || 'N/A'}</p>
                      </div>
                    ))}
                  </div>

                  {extractedData.line_items?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-mdb-muted mb-2">Line Items</p>
                      <table className="w-full text-sm border border-mdb-border rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2 text-mdb-muted font-medium">Description</th>
                            <th className="text-right p-2 text-mdb-muted font-medium">Qty</th>
                            <th className="text-right p-2 text-mdb-muted font-medium">Price</th>
                            <th className="text-right p-2 text-mdb-muted font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedData.line_items.map((item, idx) => (
                            <tr key={idx} className="border-t border-mdb-border">
                              <td className="p-2">{item.description}</td>
                              <td className="p-2 text-right">{item.quantity}</td>
                              <td className="p-2 text-right">${item.unit_price?.toFixed(2)}</td>
                              <td className="p-2 text-right font-medium">${item.total?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="border-t border-mdb-border pt-4 space-y-1.5">
                    <div className="flex justify-between text-sm"><span className="text-mdb-muted">Subtotal</span><span>${extractedData.subtotal?.toFixed(2) || '0.00'}</span></div>
                    {extractedData.discount && <div className="flex justify-between text-sm text-red-600"><span>Discount</span><span>-${extractedData.discount.toFixed(2)}</span></div>}
                    <div className="flex justify-between text-sm"><span className="text-mdb-muted">Tax</span><span>${extractedData.tax?.toFixed(2) || '0.00'}</span></div>
                    <div className="flex justify-between text-lg font-bold border-t border-mdb-border pt-2">
                      <span>Total</span><span className="text-mdb-green">${extractedData.total?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>

                  <button onClick={saveToMongoDB} disabled={isSaving}
                    className={`w-full mt-4 py-3 rounded-xl font-semibold transition-colors ${isSaving ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-mdb-green hover:bg-mdb-green/90 text-white'}`}>
                    {isSaving ? 'Saving & Indexing...' : 'Save to MongoDB & Index for RAG'}
                  </button>

                  {saveResult && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${saveResult.success ? 'bg-mdb-green-bg border border-emerald-200 text-mdb-green' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                      <p>{saveResult.message}</p>
                      {saveResult.success && saveResult.invoice_id && (
                        <p className="mt-1 text-xs text-mdb-muted">
                          Invoice: <code className="text-mdb-green font-mono">{saveResult.invoice_id}</code>
                          {saveResult.embedded && <span className="ml-2 text-mdb-green font-medium">RAG Indexed</span>}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 bg-white rounded-xl border border-mdb-border">
                  <h3 className="text-sm font-semibold text-mdb-muted mb-2">Raw JSON Response</h3>
                  <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs text-mdb-muted max-h-64 overflow-y-auto font-mono">
                    {JSON.stringify(extractedData, null, 2)}
                  </pre>
                </div>
              </>
            )}

            {!extractedData && !error && (
              <div className="p-12 bg-white rounded-xl border border-mdb-border text-center text-mdb-muted">
                <p className="text-4xl mb-3 opacity-20">🔍</p>
                <p>Upload an invoice image and click extract to see AI-powered data extraction</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
