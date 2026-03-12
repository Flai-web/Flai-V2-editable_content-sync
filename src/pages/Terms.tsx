import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface TermsProps {}

const Terms: React.FC<TermsProps> = () => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom state
  const scaleRef = useRef(1);
  const lastScaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const lastTranslateRef = useRef({ x: 0, y: 0 });
  const isPinchingRef = useRef(false);
  const initialPinchDistRef = useRef(0);
  const initialPinchMidRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    loadPDFFromURL('/Vilkar.pdf');
  }, []);

  const loadPDFFromURL = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      await loadPDF(arrayBuffer);
      setLoading(false);
    } catch (err) {
      console.error('Error loading PDF from URL:', err);
      setError('Failed to load PDF.');
      setLoading(false);
    }
  };

  const loadPDF = async (data: ArrayBuffer) => {
    try {
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setError('Error loading PDF file');
    }
  };

  const applyDarkModeFilter = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const pixelBrightness = (r + g + b) / 3;

      if (pixelBrightness > 240) {
        data[i] = 38; data[i + 1] = 38; data[i + 2] = 38;
      } else if (pixelBrightness > 200) {
        data[i] = 38 + (r - 240) * 0.5;
        data[i + 1] = 38 + (g - 240) * 0.5;
        data[i + 2] = 38 + (b - 240) * 0.5;
      } else {
        data[i] = (255 - r);
        data[i + 1] = (255 - g);
        data[i + 2] = (255 - b);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const renderPage = async (pageNum: number, container: HTMLDivElement) => {
    if (!pdfDoc) return;

    const page = await pdfDoc.getPage(pageNum);
    const dpr = window.devicePixelRatio || 1;
    const containerWidth = viewerContainerRef.current?.clientWidth || window.innerWidth;
    const maxWidth = containerWidth - 40;

    const viewport = page.getViewport({ scale: 1.0 });
    // Use full width on all screens, multiply by dpr for crisp rendering
    const cssScale = maxWidth / viewport.width;
    const renderScale = cssScale * dpr;

    const scaledViewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.id = `page-${pageNum}`;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Canvas internal resolution = scaled by dpr
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // CSS display size = scaled without dpr (so it looks correct on screen)
    canvas.style.width = `${scaledViewport.width / dpr}px`;
    canvas.style.height = `${scaledViewport.height / dpr}px`;
    canvas.style.maxWidth = '100%';
    canvas.style.display = 'block';

    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    applyDarkModeFilter(canvas);
    container.appendChild(canvas);
  };

  const renderAllPages = async () => {
    if (!pdfDoc || !canvasContainerRef.current) return;
    canvasContainerRef.current.innerHTML = '';
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      await renderPage(pageNum, canvasContainerRef.current);
    }
  };

  useEffect(() => {
    if (pdfDoc) renderAllPages();
  }, [pdfDoc]);

  useEffect(() => {
    if (!pdfDoc) return;
    const handleResize = () => renderAllPages();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDoc]);

  // Apply CSS transform to the canvas container
  const applyTransform = () => {
    if (!canvasContainerRef.current) return;
    const { x, y } = translateRef.current;
    const s = scaleRef.current;
    canvasContainerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    canvasContainerRef.current.style.transformOrigin = '0 0';
  };

  const getDistance = (t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getMidpoint = (t1: Touch, t2: Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinchingRef.current = true;
        isPanningRef.current = false;
        initialPinchDistRef.current = getDistance(e.touches[0], e.touches[1]);
        initialPinchMidRef.current = getMidpoint(e.touches[0], e.touches[1]);
        lastScaleRef.current = scaleRef.current;
        lastTranslateRef.current = { ...translateRef.current };
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        isPanningRef.current = true;
        lastPanPointRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        lastTranslateRef.current = { ...translateRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isPinchingRef.current && e.touches.length === 2) {
        e.preventDefault();
        const currentDist = getDistance(e.touches[0], e.touches[1]);
        const currentMid = getMidpoint(e.touches[0], e.touches[1]);
        const pinchScale = currentDist / initialPinchDistRef.current;
        const newScale = Math.max(0.5, Math.min(5, lastScaleRef.current * pinchScale));

        const containerRect = container.getBoundingClientRect();
        const originX = initialPinchMidRef.current.x - containerRect.left;
        const originY = initialPinchMidRef.current.y - containerRect.top;

        const scaleDiff = newScale / lastScaleRef.current;
        const newX = originX - scaleDiff * (originX - lastTranslateRef.current.x) + (currentMid.x - initialPinchMidRef.current.x);
        const newY = originY - scaleDiff * (originY - lastTranslateRef.current.y) + (currentMid.y - initialPinchMidRef.current.y);

        scaleRef.current = newScale;
        translateRef.current = { x: newX, y: newY };
        applyTransform();
      } else if (isPanningRef.current && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastPanPointRef.current.x;
        const dy = e.touches[0].clientY - lastPanPointRef.current.y;
        translateRef.current = {
          x: lastTranslateRef.current.x + dx,
          y: lastTranslateRef.current.y + dy,
        };
        lastPanPointRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        lastTranslateRef.current = { ...translateRef.current };
        applyTransform();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) isPinchingRef.current = false;
      if (e.touches.length === 0) isPanningRef.current = false;

      // Snap back if zoomed out below 1
      if (scaleRef.current < 1) {
        scaleRef.current = 1;
        translateRef.current = { x: 0, y: 0 };
        if (canvasContainerRef.current) {
          canvasContainerRef.current.style.transition = 'transform 0.2s ease';
          applyTransform();
          setTimeout(() => {
            if (canvasContainerRef.current) canvasContainerRef.current.style.transition = '';
          }, 200);
        }
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div style={styles.container}>
      <div ref={viewerContainerRef} style={styles.viewerContainer}>
        {loading ? (
          <div style={styles.status}><p style={styles.statusText}>Loading Terms...</p></div>
        ) : error ? (
          <div style={styles.status}><p style={styles.statusText}>{error}</p></div>
        ) : (
          <div ref={canvasContainerRef} style={styles.canvasContainer} />
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#262626',
    color: '#e0e0e0',
    overflow: 'hidden',
  },
  viewerContainer: {
    flex: 1,
    overflow: 'auto',
    background: '#262626',
    display: 'flex',
    justifyContent: 'center',
    padding: '20px',
    WebkitOverflowScrolling: 'touch',
  },
  canvasContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    alignItems: 'center',
    willChange: 'transform',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statusText: {
    color: '#606060',
    fontSize: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};

export default Terms;