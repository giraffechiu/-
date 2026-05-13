import React, { useState } from 'react';
import { Upload, X, Image as ImageIcon, Send, Download, Layers, CheckCircle2, AlertCircle, Loader2, Sparkles, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';

interface VariationResult {
  id: string;
  image: string;
  mimeType: string;
  source: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export default function App() {
  const [sampleAd, setSampleAd] = useState<File | null>(null);
  const [sampleAdPreview, setSampleAdPreview] = useState<string | null>(null);
  
  const [interactionMode, setInteractionMode] = useState<'text' | 'image'>('text');
  
  const [promptsText, setPromptsText] = useState('');
  const [productImages, setProductImages] = useState<File[]>([]);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);
  
  const [results, setResults] = useState<VariationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSampleAdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSampleAd(file);
      const reader = new FileReader();
      reader.onloadend = () => setSampleAdPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleProductImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setProductImages(prev => [...prev, ...files]);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setProductImagePreviews(prev => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
  };

  const removeProductImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
    setProductImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const generateVariations = async () => {
    if (!sampleAd) return;
    
    if (interactionMode === 'text' && !promptsText.trim()) return;
    if (interactionMode === 'image' && productImages.length === 0) return;

    setIsProcessing(true);
    setResults([]);

    const itemsToProcess = interactionMode === 'text' 
      ? promptsText.split('\n').filter(line => line.trim()) 
      : productImages;

    // Initialize results skeleton
    const initialResults: VariationResult[] = itemsToProcess.map((item, index) => ({
      id: Math.random().toString(36).substr(2, 9),
      image: '',
      mimeType: '',
      source: typeof item === 'string' ? item : (item as File).name,
      status: 'pending'
    }));
    setResults(initialResults);

    // Process sequentially to avoid heavy load
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const resultId = initialResults[i].id;

      setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'processing' } : r));

      try {
        const formData = new FormData();
        formData.append('sampleAd', sampleAd);
        
        if (interactionMode === 'text') {
          formData.append('prompt', item as string);
        } else {
          formData.append('productImage', item as File);
        }

        const response = await fetch('/api/generate-variation', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Variation generation failed');
        }

        const data = await response.json();
        
        setResults(prev => prev.map(r => r.id === resultId ? { 
          ...r, 
          image: data.image, 
          mimeType: data.mimeType,
          status: 'success' 
        } : r));

      } catch (error: any) {
        console.error(`Error processing variation ${i}:`, error);
        setResults(prev => prev.map(r => r.id === resultId ? { 
          ...r, 
          status: 'error', 
          error: error.message 
        } : r));
      }
    }

    setIsProcessing(false);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    results.filter(r => r.status === 'success').forEach((result, index) => {
      const base64Data = result.image;
      zip.file(`ad_variation_${index + 1}_${result.source.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' }) as Blob;
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ad_variations.zip';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingle = (result: VariationResult) => {
    const link = document.createElement('a');
    link.href = `data:${result.mimeType};base64,${result.image}`;
    link.download = `variation_${result.id}.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-amber-500/30">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-50 to-neutral-400">
              Ad Variation Builder <span className="text-amber-500">Pro</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest hidden sm:block">AI-Powered Production</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* Ad Builder Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 auto-rows-min">
          
          {/* Step 1: Upload Reference */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold">1</div>
              <h2 className="text-lg font-semibold">Upload Sample Ad (Reference)</h2>
            </div>
            
            <div 
              className={`relative aspect-[4/5] sm:aspect-square md:aspect-[4/3] lg:aspect-[3/4] border-2 border-dashed rounded-3xl overflow-hidden transition-all duration-300 ${
                sampleAd ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-800 hover:border-neutral-600 bg-neutral-900/50'
              }`}
            >
              {!sampleAd ? (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer p-8 text-center group">
                  <input type="file" className="hidden" accept="image/*" onChange={handleSampleAdUpload} />
                  <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-neutral-400" />
                  </div>
                  <p className="text-neutral-300 font-medium mb-1">Click or drag your poster</p>
                  <p className="text-neutral-500 text-sm">PNG, JPG, or WEBP up to 10MB</p>
                </label>
              ) : (
                <div className="relative w-full h-full group">
                  <img src={sampleAdPreview!} alt="Sample" className="w-full h-full object-contain p-4" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => { setSampleAd(null); setSampleAdPreview(null); }}
                      className="p-4 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-500 transition-colors"
                    >
                      <Trash2 className="w-8 h-8" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Configure Variants */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold">2</div>
              <h2 className="text-lg font-semibold">Define Product Changes</h2>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
              {/* Tab Selector */}
              <div className="flex p-1 bg-neutral-950 rounded-2xl border border-neutral-800">
                <button 
                  onClick={() => setInteractionMode('text')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    interactionMode === 'text' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Text Description
                </button>
                <button 
                  onClick={() => setInteractionMode('image')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    interactionMode === 'image' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Product Images
                </button>
              </div>

              {/* Mode Specific Inputs */}
              <AnimatePresence mode="wait">
                {interactionMode === 'text' ? (
                  <motion.div 
                    key="text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Variation List (One per line)</label>
                      <textarea 
                        className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-mono placeholder:text-neutral-700"
                        placeholder="Premium leather watch with gold dial&#10;Sporty digital smartwatch with silicon strap&#10;Minimalist analog watch with black dial"
                        value={promptsText}
                        onChange={(e) => setPromptsText(e.target.value)}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="image"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Product Photo Batch</label>
                      <div className="grid grid-cols-3 gap-3">
                        {productImagePreviews.map((preview, index) => (
                          <div key={index} className="relative aspect-square bg-neutral-950 rounded-xl overflow-hidden group border border-neutral-800">
                            <img src={preview} alt="Product" className="w-full h-full object-cover" />
                            <button 
                              onClick={() => removeProductImage(index)}
                              className="absolute top-1 right-1 p-1 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                        <label className="aspect-square bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors text-neutral-500 group">
                          <input type="file" className="hidden" multiple accept="image/*" onChange={handleProductImagesUpload} />
                          <Plus className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-medium">Add Photo</span>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button */}
              <button 
                disabled={isProcessing || !sampleAd || (interactionMode === 'text' ? !promptsText.trim() : productImages.length === 0)}
                onClick={generateVariations}
                className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-400 transition-all active:scale-95 shadow-xl shadow-white/5 group"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Layers className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                )}
                {isProcessing ? 'Generating Batch...' : 'Generate Variations'}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-8 pt-12 border-t border-neutral-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">Production Gallery</h2>
                <p className="text-neutral-500 text-sm">AI-generated variations tailored to your reference</p>
              </div>
              <button 
                onClick={downloadAll}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm font-semibold transition-all"
              >
                <Download className="w-4 h-4" />
                Download All (.ZIP)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {results.map((result) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={result.id} 
                  className="group bg-neutral-900 rounded-3xl overflow-hidden border border-neutral-800 flex flex-col"
                >
                  <div className="relative aspect-[4/5] bg-neutral-950 flex items-center justify-center overflow-hidden">
                    {result.status === 'processing' || result.status === 'pending' ? (
                      <div className="flex flex-col items-center gap-4 p-8 text-center">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 text-neutral-700 animate-spin" />
                          <Sparkles className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-neutral-400 text-sm font-medium animate-pulse">
                          {result.status === 'processing' ? 'Processing Variation...' : 'Queued for production'}
                        </p>
                      </div>
                    ) : result.status === 'error' ? (
                      <div className="flex flex-col items-center gap-2 p-8 text-center text-red-400">
                        <AlertCircle className="w-12 h-12 mb-2" />
                        <p className="font-semibold">Generation Failed</p>
                        <p className="text-xs opacity-70 break-words w-full">{result.error}</p>
                      </div>
                    ) : (
                      <>
                        <img 
                          src={`data:${result.mimeType};base64,${result.image}`} 
                          alt="Variation" 
                          className="w-full h-full object-contain cursor-zoom-in"
                          onClick={() => window.open(`data:${result.mimeType};base64,${result.image}`, '_blank')}
                        />
                        <div className="absolute top-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => downloadSingle(result)}
                            className="bg-black/80 backdrop-blur-md p-3 rounded-2xl text-white hover:bg-amber-500 transition-colors shadow-2xl"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="p-5 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Source Target</p>
                      <p className="text-sm font-medium text-neutral-300 truncate">{result.source}</p>
                    </div>
                    {result.status === 'success' && (
                      <div className="bg-green-500/10 text-green-500 p-2 rounded-xl">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-neutral-900">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-neutral-500 text-sm">
          <p>© 2026 Ad Variation Builder Pro. All rights reserved.</p>
          <div className="flex items-center gap-8 font-mono text-[10px] uppercase tracking-widest">
            <span className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> System Active</span>
            <span className="flex items-center gap-2">Powered by Gemini 2.5 Flash Image</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
