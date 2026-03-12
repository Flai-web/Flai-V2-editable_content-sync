import React, { useEffect, useRef } from 'react';

interface CodeFile {
  filename: string;
  language: 'html' | 'javascript' | 'typescript' | 'python' | 'tsx';
  content: string;
}

interface CodeProjectRendererProps {
  files: CodeFile[];
}

// Transpile TS/TSX to JS using Babel standalone (loaded once globally)
let babelLoaded = false;
let babelLoadPromise: Promise<void> | null = null;

function loadBabel(): Promise<void> {
  if (babelLoaded) return Promise.resolve();
  if (babelLoadPromise) return babelLoadPromise;
  babelLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js';
    s.onload = () => { babelLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return babelLoadPromise;
}

function transpile(content: string, filename: string, language: string): string {
  try {
    const win = window as any;
    if (!win.Babel) return content;
    const result = win.Babel.transform(content, {
      presets: [
        ['typescript', { allExtensions: true, isTSX: language === 'tsx' }],
        ['react', { runtime: 'classic' }],
      ],
      filename,
    });
    return result.code ?? content;
  } catch (e: any) {
    console.error(`[CodeProject] Babel error in ${filename}:`, e.message);
    return content;
  }
}

const CodeProjectRenderer: React.FC<CodeProjectRendererProps> = ({ files }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!iframeRef.current || !files.length) return;

    const htmlFile = files.find(f => f.language === 'html');
    if (!htmlFile) return;

    let cancelled = false;

    (async () => {
      // Ensure Babel is available on the host page for transpilation
      await loadBabel();
      if (cancelled) return;

      // Revoke old blob URLs
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];

      // Build blob URL map for all non-HTML files
      const blobMap: Record<string, string> = {};

      for (const file of files.filter(f => f.language !== 'html')) {
        let content = file.content;

        if (file.language === 'typescript' || file.language === 'tsx') {
          content = transpile(content, file.filename, file.language);
        }

        const mime =
          file.language === 'python' ? 'text/plain' : 'application/javascript';
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        blobUrlsRef.current.push(url);

        // Register under all common import path variants
        blobMap[file.filename] = url;
        blobMap[`./${file.filename}`] = url;
        blobMap[`/${file.filename}`] = url;

        // Also register the full domain URL so direct https://flai.dk/File.tsx imports are remapped
        const origin = window.location.origin;
        blobMap[`${origin}/${file.filename}`] = url;
      }

      // Parse the HTML so we can safely manipulate it
      const parser = new DOMParser();
      let htmlContent = htmlFile.content;

      // ── Step 1: strip ALL <script type="module"> tags and collect their src/content
      // We must do this BEFORE inserting the importmap, because any module script
      // that exists in the DOM before the importmap causes "importmap not allowed" error.
      const moduleScriptRegex = /<script([^>]*type=["']module["'][^>]*)>([\s\S]*?)<\/script>/gi;
      const externalModuleRegex = /<script([^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*)><\/script>/gi;

      const collectedModuleScripts: Array<{ src?: string; content?: string }> = [];

      // Collect external module scripts
      htmlContent = htmlContent.replace(externalModuleRegex, (_match, _attrs, src) => {
        collectedModuleScripts.push({ src });
        return '<!-- module script placeholder -->';
      });

      // Collect inline module scripts
      htmlContent = htmlContent.replace(moduleScriptRegex, (_match, _attrs, content) => {
        if (content.trim()) {
          collectedModuleScripts.push({ content: content.trim() });
        }
        return '<!-- module script placeholder -->';
      });

      // ── Step 2: rewrite src/href on non-module tags
      htmlContent = htmlContent.replace(
        /(src|href)=["']([^"']+)["']/g,
        (_match, attr, val) => {
          const resolved =
            blobMap[val] ?? blobMap[`./${val}`] ?? blobMap[`/${val}`] ?? blobMap[`${window.location.origin}/${val}`];
          return resolved ? `${attr}="${resolved}"` : `${attr}="${val}"`;
        }
      );

      // ── Step 3: build the importmap JSON — must be injected FIRST in <head>
      const importMapJson = JSON.stringify({ imports: blobMap });
      const importMapTag = `<script type="importmap">${importMapJson}</script>`;

      // ── Step 4: rebuild the collected module scripts, rewriting their imports
      const rebuiltScripts = collectedModuleScripts.map(({ src, content }) => {
        if (src) {
          // Remap src to blob URL if we have it, otherwise keep original
          const resolved =
            blobMap[src] ?? blobMap[`./${src}`] ?? blobMap[`/${src}`] ?? blobMap[`${window.location.origin}/${src}`];
          const finalSrc = resolved ?? src;
          return `<script type="module" src="${finalSrc}"></script>`;
        }
        if (content) {
          // Rewrite import paths inside inline module scripts
          const rewritten = content.replace(
            /from\s+["']([^"']+)["']/g,
            (_m: string, path: string) => {
              const resolved =
                blobMap[path] ??
                blobMap[`./${path}`] ??
                blobMap[`/${path}`] ??
                blobMap[`${window.location.origin}/${path}`];
              return `from "${resolved ?? path}"`;
            }
          );
          return `<script type="module">${rewritten}</script>`;
        }
        return '';
      }).join('\n');

      // ── Step 5: inject importmap first, then rebuilt scripts at end of <body>
      if (htmlContent.includes('<head>')) {
        htmlContent = htmlContent.replace('<head>', `<head>\n${importMapTag}`);
      } else {
        htmlContent = `<head>${importMapTag}</head>\n` + htmlContent;
      }

      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${rebuiltScripts}\n</body>`);
      } else {
        htmlContent += rebuiltScripts;
      }

      const iframeDoc =
        iframeRef.current?.contentDocument ??
        iframeRef.current?.contentWindow?.document;

      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();
      }
    })();

    return () => {
      cancelled = true;
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, [files]);

  return (
    <div className="w-full bg-white rounded-lg overflow-hidden shadow-xl">
      <iframe
        ref={iframeRef}
        className="w-full h-[600px] border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        title="Code Project"
      />
    </div>
  );
};

export default CodeProjectRenderer;