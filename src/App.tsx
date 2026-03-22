import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Move, 
  Maximize2, 
  Download, 
  ArrowLeft, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  RefreshCw,
  Sun,
  Moon,
  Key
} from 'lucide-react';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import { expandImage } from './services/geminiService';
import confetti from 'canvas-confetti';

// Extend window for AI Studio API
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type AspectRatio = '1:1' | '9:16' | '16:9';

export default function App() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [prompt, setPrompt] = useState('');
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState({ x: 1, y: 1 });
  const [imageRotation, setImageRotation] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  
  const [img] = useImage(uploadedImage || '');
  const stageRef = useRef<any>(null);
  const imageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // Calculate canvas dimensions based on aspect ratio
  const getCanvasSize = () => {
    const base = 500;
    if (aspectRatio === '1:1') return { width: base, height: base };
    if (aspectRatio === '9:16') return { width: base * (9/16), height: base };
    if (aspectRatio === '16:9') return { width: base, height: base * (9/16) };
    return { width: base, height: base };
  };

  const canvasSize = getCanvasSize();

  // Reset image position when a new image is uploaded or aspect ratio changes
  useEffect(() => {
    if (img) {
      const stageWidth = canvasSize.width;
      const stageHeight = canvasSize.height;
      
      // Initial scale to fit within canvas
      const scale = Math.min(stageWidth / img.width, stageHeight / img.height) * 0.8;
      setImageScale({ x: scale, y: scale });
      setImageRotation(0);
      
      // Center image
      setImagePos({
        x: (stageWidth - img.width * scale) / 2,
        y: (stageHeight - img.height * scale) / 2,
      });
    }
  }, [img, aspectRatio]);

  useEffect(() => {
    if (uploadedImage && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [uploadedImage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExpand = async () => {
    if (!uploadedImage || !img) return;
    if (!hasApiKey) {
      handleSelectKey();
      return;
    }
    
    setLoading(true);
    try {
      // Capture the stage as the composition
      if (trRef.current) trRef.current.hide();
      const compositionDataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      if (trRef.current) trRef.current.show();

      const result = await expandImage(compositionDataUrl, aspectRatio, prompt);
      if (result) {
        // Create a composite to ensure original image is "on top" and perfectly preserved
        const compositeCanvas = document.createElement('canvas');
        const resultImg = new Image();
        
        await new Promise((resolve, reject) => {
          resultImg.onload = resolve;
          resultImg.onerror = reject;
          resultImg.src = result;
        });

        compositeCanvas.width = resultImg.width;
        compositeCanvas.height = resultImg.height;
        const ctx = compositeCanvas.getContext('2d');
        
        if (ctx) {
          // 1. Draw the AI result as background
          ctx.drawImage(resultImg, 0, 0);
          
          // 2. Prepare the feathered original image
          const featherAmount = 20; // Pixels to feather
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tCtx = tempCanvas.getContext('2d');
          
          if (tCtx) {
            // Draw original image to temp canvas
            tCtx.drawImage(img, 0, 0);
            
            // Create a mask to soften the edges
            tCtx.globalCompositeOperation = 'destination-in';
            
            // Create a radial-like gradient but for a rectangle (feathering edges)
            const gradientMask = tCtx.createLinearGradient(0, 0, 0, featherAmount);
            gradientMask.addColorStop(0, 'rgba(0,0,0,0)');
            gradientMask.addColorStop(1, 'rgba(0,0,0,1)');
            
            // Top edge
            tCtx.fillStyle = gradientMask;
            tCtx.fillRect(0, 0, img.width, featherAmount);
            
            // Bottom edge
            const bottomGrad = tCtx.createLinearGradient(0, img.height, 0, img.height - featherAmount);
            bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
            bottomGrad.addColorStop(1, 'rgba(0,0,0,1)');
            tCtx.fillStyle = bottomGrad;
            tCtx.fillRect(0, img.height - featherAmount, img.width, featherAmount);
            
            // Left edge
            const leftGrad = tCtx.createLinearGradient(0, 0, featherAmount, 0);
            leftGrad.addColorStop(0, 'rgba(0,0,0,0)');
            leftGrad.addColorStop(1, 'rgba(0,0,0,1)');
            tCtx.fillStyle = leftGrad;
            tCtx.fillRect(0, 0, featherAmount, img.height);
            
            // Right edge
            const rightGrad = tCtx.createLinearGradient(img.width, 0, img.width - featherAmount, 0);
            rightGrad.addColorStop(0, 'rgba(0,0,0,0)');
            rightGrad.addColorStop(1, 'rgba(0,0,0,1)');
            tCtx.fillStyle = rightGrad;
            tCtx.fillRect(img.width - featherAmount, 0, featherAmount, img.height);
            
            // Fill the center
            tCtx.fillStyle = 'black';
            tCtx.fillRect(featherAmount, featherAmount, img.width - featherAmount * 2, img.height - featherAmount * 2);

            // 3. Draw the feathered original image on top at the correct position
            const scaleFactor = resultImg.width / canvasSize.width;
            
            ctx.save();
            ctx.translate(imagePos.x * scaleFactor, imagePos.y * scaleFactor);
            ctx.rotate((imageRotation * Math.PI) / 180);
            ctx.scale(imageScale.x * scaleFactor, imageScale.y * scaleFactor);
            
            // Draw the processed (feathered) image
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
          }
          
          setResultImage(compositeCanvas.toDataURL('image/png'));
        } else {
          setResultImage(result);
        }

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (error) {
      console.error(error);
      // If key error, reset key state
      if (error instanceof Error && error.message.includes("Requested entity was not found")) {
        setHasApiKey(false);
      }
      alert("Error al procesar la imagen. Por favor, asegúrate de tener una API Key válida y fondos suficientes.");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.download = 'expanded-image.png';
    link.href = resultImage;
    link.click();
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans selection:bg-[#5A5A40] selection:text-white ${
      darkMode ? 'bg-[#121212] text-white' : 'bg-[#F5F5F0] text-[#141414]'
    }`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-50 backdrop-blur-md transition-colors duration-500 ${
        darkMode ? 'bg-[#1A1A1A]/80 border-white/10' : 'bg-white/50 border-[#141414]/10'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#5A5A40]/20">
              <Sparkles size={22} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Expand AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full transition-all ${
                darkMode ? 'bg-white/10 text-yellow-400 hover:bg-white/20' : 'bg-[#141414]/5 text-[#141414]/60 hover:bg-[#141414]/10'
              }`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            {!hasApiKey && (
              <button 
                onClick={handleSelectKey}
                className="px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-bold flex items-center gap-2 hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
              >
                <Key size={16} />
                Configurar API Key
              </button>
            )}

            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 border ${
                darkMode 
                ? 'bg-white/10 border-white/10 text-white hover:bg-white/20' 
                : 'bg-white border-[#141414]/10 text-[#141414] hover:bg-[#F5F5F0]'
              }`}
            >
              <Upload size={16} />
              Subir Imagen
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-8">
          <section className={`rounded-3xl p-8 shadow-sm border transition-colors duration-500 space-y-8 ${
            darkMode ? 'bg-[#1A1A1A] border-white/5' : 'bg-white border-[#141414]/5'
          }`}>
            {/* Aspect Ratio Selection */}
            <div className="space-y-4">
              <label className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
                darkMode ? 'text-white/40' : 'text-[#141414]/40'
              }`}>
                <Maximize2 size={14} />
                Formato de Salida
              </label>
              <div className="flex gap-3">
                {[
                  { id: '1:1', label: 'Cuadrado', sub: '1:1' },
                  { id: '9:16', label: 'Vertical', sub: '9:16' },
                  { id: '16:9', label: 'Horizontal', sub: '16:9' },
                ].map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => setAspectRatio(ratio.id as AspectRatio)}
                    className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                      aspectRatio === ratio.id 
                      ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-md' 
                      : darkMode
                        ? 'bg-white/5 border-white/10 text-white/60 hover:border-[#5A5A40]/50 hover:bg-white/10'
                        : 'bg-white border-[#141414]/10 text-[#141414]/60 hover:border-[#5A5A40]/30 hover:bg-[#F5F5F0]'
                    }`}
                  >
                    <span className="text-sm font-bold">{ratio.label}</span>
                    <span className={`text-[10px] opacity-60 ${aspectRatio === ratio.id ? 'text-white' : ''}`}>{ratio.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="space-y-4">
              <label className={`text-xs font-bold uppercase tracking-widest ${
                darkMode ? 'text-white/40' : 'text-[#141414]/40'
              }`}>
                Instrucciones Adicionales (Opcional)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej: Añade más nubes al cielo, continúa el bosque..."
                className={`w-full h-24 p-4 rounded-2xl border outline-none transition-all text-sm resize-none ${
                  darkMode 
                  ? 'bg-white/5 border-white/10 text-white focus:border-[#5A5A40]/50 focus:bg-white/10' 
                  : 'bg-[#F5F5F0] border-transparent focus:border-[#5A5A40]/30 focus:bg-white text-[#141414]'
                }`}
              />
            </div>

            {/* Action Button */}
            <button
              onClick={handleExpand}
              disabled={!uploadedImage || loading}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg transition-all ${
                !uploadedImage || loading
                ? darkMode ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-[#141414]/10 text-[#141414]/30 cursor-not-allowed'
                : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30] shadow-xl shadow-[#5A5A40]/20 active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Expandir Imagen
                </>
              )}
            </button>
          </section>
        </div>

        {/* Right Column: Canvas & Results */}
        <div className="lg:col-span-8 space-y-8">
          {/* Editor Canvas */}
          <div className={`rounded-[40px] p-12 shadow-sm border transition-colors duration-500 flex flex-col items-center justify-center min-h-[600px] relative overflow-hidden ${
            darkMode ? 'bg-[#1A1A1A] border-white/5' : 'bg-white border-[#141414]/5'
          }`}>
            {!uploadedImage ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`group cursor-pointer flex flex-col items-center gap-6 p-12 rounded-[32px] border-2 border-dashed transition-all ${
                  darkMode 
                  ? 'border-white/10 hover:border-[#5A5A40]/40 hover:bg-white/5' 
                  : 'border-[#141414]/10 hover:border-[#5A5A40]/40 hover:bg-[#F5F5F0]/50'
                }`}
              >
                <div className={`w-20 h-20 rounded-full flex items-center justify-center group-hover:scale-110 transition-all ${
                  darkMode ? 'bg-white/5 text-white/20 group-hover:text-[#5A5A40]/60' : 'bg-[#F5F5F0] text-[#141414]/20 group-hover:text-[#5A5A40]/60'
                }`}>
                  <ImageIcon size={40} />
                </div>
                <div className="text-center">
                  <p className={`text-xl font-semibold ${darkMode ? 'text-white/40' : 'text-[#141414]/60'}`}>Sube una imagen para comenzar</p>
                  <p className={`text-sm mt-2 ${darkMode ? 'text-white/20' : 'text-[#141414]/30'}`}>Arrastra y suelta o haz clic para buscar</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8 w-full flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-4">
                  <h3 className={`text-sm font-bold uppercase tracking-widest ${darkMode ? 'text-white/40' : 'text-[#141414]/40'}`}>Lienzo de Posicionamiento</h3>
                  <button 
                    onClick={() => setUploadedImage(null)}
                    className="text-xs font-bold text-[#FF4444] hover:underline"
                  >
                    Cambiar Imagen
                  </button>
                </div>
                
                {/* Konva Stage */}
                <div className={`relative rounded-2xl shadow-inner overflow-hidden border transition-colors duration-500 ${
                  darkMode ? 'bg-[#121212] border-white/5' : 'bg-[#F5F5F0] border-[#141414]/5'
                }`}>
                  <Stage
                    width={canvasSize.width}
                    height={canvasSize.height}
                    ref={stageRef}
                    onMouseDown={(e) => {
                      // Deselect when clicking on empty area
                      const clickedOnEmpty = e.target === e.target.getStage();
                      if (clickedOnEmpty && trRef.current) {
                        trRef.current.nodes([]);
                      }
                    }}
                  >
                    <Layer>
                      {img && (
                        <>
                          <KonvaImage
                            image={img}
                            ref={imageRef}
                            x={imagePos.x}
                            y={imagePos.y}
                            scaleX={imageScale.x}
                            scaleY={imageScale.y}
                            rotation={imageRotation}
                            draggable
                            onClick={() => {
                              if (trRef.current) trRef.current.nodes([imageRef.current]);
                            }}
                            onTap={() => {
                              if (trRef.current) trRef.current.nodes([imageRef.current]);
                            }}
                            onDragEnd={(e) => {
                              setImagePos({ x: e.target.x(), y: e.target.y() });
                            }}
                            onTransformEnd={() => {
                              const node = imageRef.current;
                              const scaleX = node.scaleX();
                              const scaleY = node.scaleY();
                              setImageScale({ x: scaleX, y: scaleY });
                              setImageRotation(node.rotation());
                              setImagePos({ x: node.x(), y: node.y() });
                            }}
                          />
                          <Transformer
                            ref={trRef}
                            boundBoxFunc={(oldBox, newBox) => {
                              // Limit resize
                              if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                                return oldBox;
                              }
                              return newBox;
                            }}
                          />
                        </>
                      )}
                    </Layer>
                  </Stage>
                  
                  {/* Grid Overlay */}
                  <div className={`absolute inset-0 pointer-events-none border-2 rounded-2xl ${
                    darkMode ? 'border-[#5A5A40]/40' : 'border-[#5A5A40]/20'
                  }`} />
                </div>
                
                <p className={`text-xs italic ${darkMode ? 'text-white/20' : 'text-[#141414]/40'}`}>
                  * Arrastra y redimensiona la imagen para definir el área de expansión.
                </p>
              </div>
            )}
          </div>

          {/* Result Section */}
          {resultImage && (
            <div className={`rounded-[40px] p-12 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 ${
              darkMode ? 'bg-[#1A1A1A] border border-white/5' : 'bg-[#141414]'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center text-white">
                    <Sparkles size={16} />
                  </div>
                  <h3 className="text-white font-bold uppercase tracking-widest text-sm">Resultado Generado</h3>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setResultImage(null)}
                    className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                    title="Reintentar"
                  >
                    <RefreshCw size={20} />
                  </button>
                  <button 
                    onClick={downloadImage}
                    className="px-6 py-3 rounded-full bg-white text-[#141414] font-bold flex items-center gap-2 hover:bg-[#F5F5F0] transition-all shadow-lg"
                  >
                    <Download size={20} />
                    Descargar
                  </button>
                </div>
              </div>
              
              <div className="relative rounded-2xl overflow-hidden bg-black/40 border border-white/10 aspect-video flex items-center justify-center">
                <img 
                  src={resultImage} 
                  alt="Expanded Result" 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className={`max-w-7xl mx-auto px-6 py-12 border-t transition-colors duration-500 ${
        darkMode ? 'border-white/5' : 'border-[#141414]/5'
      }`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className={`text-sm font-medium ${darkMode ? 'text-white/20' : 'text-[#141414]/40'}`}>
            © 2026 Image Expander AI. Potenciado por Gemini 3.1 Flash.
          </p>
          <div className="flex gap-8">
            <a href="#" className={`text-xs font-bold uppercase tracking-widest transition-all ${
              darkMode ? 'text-white/20 hover:text-[#5A5A40]' : 'text-[#141414]/40 hover:text-[#5A5A40]'
            }`}>Privacidad</a>
            <a href="#" className={`text-xs font-bold uppercase tracking-widest transition-all ${
              darkMode ? 'text-white/20 hover:text-[#5A5A40]' : 'text-[#141414]/40 hover:text-[#5A5A40]'
            }`}>Términos</a>
            <a href="#" className={`text-xs font-bold uppercase tracking-widest transition-all ${
              darkMode ? 'text-white/20 hover:text-[#5A5A40]' : 'text-[#141414]/40 hover:text-[#5A5A40]'
            }`}>Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
