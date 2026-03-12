import { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { syncAllToMeilisearch } from '../utils/meilisearchSync';
import { multiSearch } from '../utils/meilisearch';
import { getSearchTerms, termMatches } from '../utils/searchSynonyms';
import type { Product, PortfolioImage } from '../types';

// ─── Result types ──────────────────────────────────────────────────────────────

export interface PageResult {
  id: string;
  title: string;
  description: string;
  url: string;
  _highlight?: { title?: string; description?: string };
}

export interface ProductResult {
  product: Product;
  _highlight?: { name?: string; description?: string; category?: string };
  _snippet?: string;
  _score?: number;
}

export interface PortfolioResult {
  item: PortfolioImage;
  _highlight?: { title?: string };
}

export interface SearchResults {
  products: ProductResult[];
  portfolio: PortfolioResult[];
  pages: PageResult[];
  total: number;
  productFacets?: Record<string, number>;
}

export interface SearchFilters {
  category?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'name_asc' | '';
}

const EMPTY: SearchResults = { products: [], portfolio: [], pages: [], total: 0 };

const STATIC_PAGES: PageResult[] = [
  { id: 'home',      title: 'Forside',         description: 'Dronefotografering og luftoptagelser i Danmark',   url: '/'          },
  { id: 'products',  title: 'Vores Tjenester', description: 'Se alle vores drone tjenester og priser',           url: '/products'  },
  { id: 'portfolio', title: 'Vores Arbejde',   description: 'Se eksempler på vores droneoptagelser og luftfoto', url: '/portfolio' },
  { id: 'coverage',  title: 'Dækningsområder', description: 'Se hvor vi tilbyder droneoptagelser',              url: '/coverage'  },
  { id: 'contact',   title: 'Kontakt',         description: 'Kom i kontakt med os',                             url: '/contact'   },
  { id: 'booking',   title: 'Book nu',         description: 'Book din droneoptagelse online',                    url: '/booking'   },
  { id: 'ratings',   title: 'Anmeldelser',     description: 'Se hvad vores kunder siger om os',                 url: '/ratings'   },
];

// ─── Sync gate ─────────────────────────────────────────────────────────────────

let syncDone = false;
let syncPromise: Promise<void> | null = null;

function ensureSynced(): Promise<void> {
  if (syncDone) return Promise.resolve();
  if (syncPromise) return syncPromise;
  syncPromise = syncAllToMeilisearch()
    .then(() => { syncDone = true; })
    .catch(() => { syncDone = true; });
  return syncPromise;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function applyProductFilters(products: ProductResult[], filters: SearchFilters): ProductResult[] {
  let r = [...products];
  if (filters.category) r = r.filter(({ product: p }) => p.category === filters.category);
  if (filters.sortBy === 'price_asc')  r.sort((a, b) => a.product.price - b.product.price);
  if (filters.sortBy === 'price_desc') r.sort((a, b) => b.product.price - a.product.price);
  if (filters.sortBy === 'name_asc')   r.sort((a, b) => a.product.name.localeCompare(b.product.name, 'da'));
  return r;
}

// ─── Local fallback ────────────────────────────────────────────────────────────

function localSearch(query: string, filters: SearchFilters, allProducts: Product[], portfolioImages: PortfolioImage[]): SearchResults {
  const terms = getSearchTerms(query);
  if (terms.length === 0) return EMPTY;

  const scored = allProducts
    .map(p => {
      const haystack = `${p.name} ${p.description} ${p.category}`;
      const hits = terms.filter(t => termMatches(t, haystack)).length;
      return { product: p, hits };
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits);

  let products: ProductResult[] = scored.map(({ product }) => ({ product }));
  products = applyProductFilters(products, filters);

  const portfolio: PortfolioResult[] = portfolioImages
    .filter(img => terms.some(t => termMatches(t, img.title)))
    .map(item => ({ item }));

  const pages = STATIC_PAGES.filter(p =>
    terms.some(t => termMatches(t, `${p.title} ${p.description}`))
  );

  return { products, portfolio, pages, total: products.length + portfolio.length + pages.length };
}

// ─── Map Meilisearch response ──────────────────────────────────────────────────

function mapMeili(
  raw: Awaited<ReturnType<typeof multiSearch>>,
  allProducts: Product[],
  allPortfolio: PortfolioImage[],
  filters: SearchFilters
): SearchResults {
  const productById = new Map(allProducts.map(p => [String(p.id), p]));
  const portfolioById = new Map(allPortfolio.map(p => [String(p.id), p]));

  let products: ProductResult[] = raw.products.hits
    .map(hit => {
      const product = productById.get(String(hit.id));
      if (!product) return null;
      const fmt = hit._formatted as Record<string, string> | undefined;
      return {
        product,
        _highlight: { name: fmt?.name, description: fmt?.description, category: fmt?.category },
        _snippet: fmt?.description ?? fmt?.name,
        _score: hit._rankingScore,
      } as ProductResult;
    })
    .filter((r): r is ProductResult => r !== null);

  products = applyProductFilters(products, filters);

  const portfolio: PortfolioResult[] = raw.portfolio.hits
    .map(hit => {
      const item = portfolioById.get(String(hit.id));
      if (!item) return null;
      const fmt = hit._formatted as Record<string, string> | undefined;
      return { item, _highlight: { title: fmt?.title } } as PortfolioResult;
    })
    .filter((r): r is PortfolioResult => r !== null);

  const pages: PageResult[] = raw.pages.hits.map(hit => {
    const fmt = hit._formatted as Record<string, string> | undefined;
    return {
      id: String(hit.id),
      title: hit.title,
      description: hit.description,
      url: hit.url,
      _highlight: { title: fmt?.title, description: fmt?.description },
    };
  });

  const productFacets = raw.products.facetDistribution?.category;

  return {
    products, portfolio, pages,
    total: products.length + portfolio.length + pages.length,
    productFacets,
  };
}

// ─── Main hook ─────────────────────────────────────────────────────────────────

export function useSearch(query: string, filters: SearchFilters = {}) {
  const { products: allProducts, portfolioImages } = useData();
  const [results, setResults]         = useState<SearchResults>(EMPTY);
  const [loading, setLoading]         = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [synced, setSynced]           = useState(syncDone);
  const [ready, setReady]             = useState(syncDone); // true only when final Meilisearch results are in
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const latest = useRef('');

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(EMPTY); setSuggestions([]); setLoading(false); setReady(true); return; }

    latest.current = q;
    setLoading(true);
    setReady(false); // results are not final yet — show skeletons

    const tid = setTimeout(async () => {
      // 1. Compute local results but DO NOT show them yet — they'll swap once Meilisearch responds
      const local = localSearch(q, filters, allProducts, portfolioImages);

      // 2. Sync once per session
      if (!syncDone) setSyncing(true);
      await ensureSynced();
      if (latest.current !== q) return;
      setSyncing(false);
      setSynced(true);

      // 3. Meilisearch search — this is the final, stable result set
      let finalResults = local;
      try {
        const productSort = filters.sortBy === 'price_asc'  ? ['price:asc']
                          : filters.sortBy === 'price_desc' ? ['price:desc']
                          : filters.sortBy === 'name_asc'   ? ['name:asc']
                          : undefined;
        const raw = await multiSearch(q, {
          productLimit: 20, portfolioLimit: 20, pageLimit: 10, contentLimit: 0,
          productFilters: filters.category ? `category = "${filters.category}"` : undefined,
          productSort,
        });
        if (latest.current !== q) return;
        const meili = mapMeili(raw, allProducts, portfolioImages, filters);
        if (meili.total > 0) finalResults = meili;
      } catch {
        // fall through to local results
      }

      if (latest.current !== q) return;

      // Commit the final stable results and reveal them all at once
      setResults(finalResults);
      setReady(true);
      setLoading(false);

      setSuggestions(
        allProducts
          .map(p => p.name)
          .filter(name => {
            const terms = getSearchTerms(q);
            return terms.length > 0 &&
              terms.some(t => name.toLowerCase().includes(t.toLowerCase())) &&
              name.toLowerCase() !== q.toLowerCase();
          })
          .slice(0, 5)
      );
    }, 150);

    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.category, filters.sortBy, allProducts.length, portfolioImages.length]);

  return { results, loading, syncing, synced, ready, suggestions };
}

// ─── getHighlight — standalone export used by SearchPage ──────────────────────
// FIX: was missing entirely — SearchPage imported it but it didn't exist

export function getHighlight(meiliHtml: string | undefined, fallback: string, query: string): string {
  if (meiliHtml && meiliHtml.includes('<mark>')) return meiliHtml;
  if (!fallback || !query.trim()) return fallback ?? '';
  const terms = getSearchTerms(query);
  if (!terms.length) return fallback;
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return fallback.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

// ─── useHighlight — hook alias (kept for backward compat) ─────────────────────

export function useHighlight(meiliHtml: string | undefined, fallback: string, query: string): string {
  return getHighlight(meiliHtml, fallback, query);
}

export type { Product, PortfolioImage };