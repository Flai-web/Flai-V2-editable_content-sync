import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';


import {
  Product,
  AddressZone,
  PortfolioImage,
  DiscountCode,
  NewsletterSubscriber,
  Newsletter,
  NewsletterTemplate,
  BookingWithProduct,
} from '../types';
import { useAuth } from './AuthContext';
import { useLoading } from './LoadingContext';


// ─── Types ────────────────────────────────────────────────────────────────────
interface SiteContent {
  id: string;
  key: string;
  type: 'text' | 'image' | 'color';
  value: string;
  description: string;
  category: string;
  created_at: string;
  updated_at: string;
}
interface HomeSection {
  id: string;
  title: string;
  description: string;
  image_url: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface Bundle {
  id: string;
  name: string;
  created_at: string;
}

interface DataContextType {
  // Products
  products: Product[];
  // Site Content
  siteContent: Record<string, SiteContent>;
  getContent: (key: string, fallback?: string) => string;
  getContentItem: (key: string) => SiteContent | undefined;
  getContentLoadingState: (key: string) => 'idle' | 'loading' | 'loaded' | 'error';
  // Home Sections
  homeSections: HomeSection[];
  // Portfolio
  portfolioImages: PortfolioImage[];
  // Bundles
  bundles: Bundle[];
  // Address Zones
  addressZones: AddressZone[];
  // Bookings
  bookings: BookingWithProduct[];
  bookingsLoading: boolean;
  bookingsError: string | null;
  // Discount Codes
  discountCodes: DiscountCode[];
  // Newsletter
  newsletterSubscribers: NewsletterSubscriber[];
  newsletters: Newsletter[];
  newsletterTemplates: NewsletterTemplate[];
  // Loading states
  isDataLoaded: boolean;
  dataError: string | null;
  isSiteContentLoaded: boolean;
  isProductsLoaded: boolean;
  isPortfolioLoaded: boolean;
  isHomeSectionsLoaded: boolean;
  isBookingsLoaded: boolean;
  isDiscountCodesLoaded: boolean;
  isNewslettersLoaded: boolean;
  isNewsletterSubscribersLoaded: boolean;
  isNewsletterTemplatesLoaded: boolean;
  isAddressZonesLoaded: boolean;
  // Refresh functions
  refreshProducts: () => Promise<void>;
  refreshSiteContent: () => Promise<void>;
  optimisticRemoveContent: (keys: string | string[]) => void;
  refreshHomeSections: () => Promise<void>;
  refreshPortfolio: () => Promise<void>;
  refreshBundles: () => Promise<void>;
  refreshBookings: () => Promise<void>;
  refreshDiscountCodes: () => Promise<void>;
  refreshNewsletterSubscribers: () => Promise<void>;
  refreshNewsletters: () => Promise<void>;
  refreshNewsletterTemplates: () => Promise<void>;
  refreshAddressZones: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { setLoadingProgress, setLoadingMessage } = useLoading();
  const location = useLocation();

  // ─── Data states ──────────────────────────────────────────────────────────
  const [products, setProducts]                         = useState<Product[]>([]);
  const [siteContent, setSiteContent]                   = useState<Record<string, SiteContent>>({});
  const [homeSections, setHomeSections]                 = useState<HomeSection[]>([]);
  const [portfolioImages, setPortfolioImages]           = useState<PortfolioImage[]>([]);
  const [bundles, setBundles]                           = useState<Bundle[]>([]);
  const [addressZones, setAddressZones]                 = useState<AddressZone[]>([]);
  const [bookings, setBookings]                         = useState<BookingWithProduct[]>([]);
  const [discountCodes, setDiscountCodes]               = useState<DiscountCode[]>([]);
  const [newsletterSubscribers, setNewsletterSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [newsletters, setNewsletters]                   = useState<Newsletter[]>([]);
  const [newsletterTemplates, setNewsletterTemplates]   = useState<NewsletterTemplate[]>([]);

  // ─── Loading flags ────────────────────────────────────────────────────────
  const [isDataLoaded, setIsDataLoaded]                             = useState(false);
  const [dataError, setDataError]                                   = useState<string | null>(null);
  const [bookingsLoading, setBookingsLoading]                       = useState(false);
  const [bookingsError, setBookingsError]                           = useState<string | null>(null);
  const [isSiteContentLoaded, setIsSiteContentLoaded]               = useState(false);
  const [isProductsLoaded, setIsProductsLoaded]                     = useState(false);
  const [isPortfolioLoaded, setIsPortfolioLoaded]                   = useState(false);
  const [isHomeSectionsLoaded, setIsHomeSectionsLoaded]             = useState(false);
  const [isBookingsLoaded, setIsBookingsLoaded]                     = useState(false);
  const [isDiscountCodesLoaded, setIsDiscountCodesLoaded]           = useState(false);
  const [isNewslettersLoaded, setIsNewslettersLoaded]               = useState(false);
  const [isNewsletterSubscribersLoaded, setIsNewsletterSubscribersLoaded] = useState(false);
  const [isNewsletterTemplatesLoaded, setIsNewsletterTemplatesLoaded]     = useState(false);
  const [isAddressZonesLoaded, setIsAddressZonesLoaded]             = useState(false);

  // ─── Internal refs ────────────────────────────────────────────────────────
  const hasInitiallyLoaded      = useRef(false);
  const [realtimeKey, setRealtimeKey]               = useState(0);
  const subscriptionRefs        = useRef<Map<string, any>>(new Map());

  // ─── Auth-gated cache invalidation ────────────────────────────────────────
  type PageDataKey = 'products' | 'homeSections' | 'portfolio' | 'bundles'
    | 'bookings' | 'discountCodes' | 'newsletters' | 'newsletterSubscribers'
    | 'newsletterTemplates' | 'addressZones';

  const loadedCache = useRef<Set<PageDataKey>>(new Set());
  const prevUserId  = useRef<string | undefined>(user?.id);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getContent     = (key: string, fallback: string = '') => siteContent[key]?.value || fallback;
  const getContentItem = (key: string) => siteContent[key];
  const getContentLoadingState = (_key: string): 'idle' | 'loading' | 'loaded' | 'error' => {
    return isSiteContentLoaded ? 'loaded' : 'loading';
  };

  /**
   * SINGLE-SHOT CONTENT LOAD
   * Fetches all site_content rows in one query. No phases, no debouncing,
   * no sequential round-trips. Fastest possible approach — one DB call,
   * everything lands in state at once, isSiteContentLoaded flips true.
   * Subsequent calls are no-ops because allContentLoaded guards them.
   */
  const allContentLoaded = useRef(false);

  const fetchAllContent = useCallback(async () => {
    // Already have everything — instant return, no DB call.
    if (allContentLoaded.current) {
      setIsSiteContentLoaded(true);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('key');
      if (error) throw error;
      setSiteContent(prev => {
        const next = { ...prev };
        (data || []).forEach(item => { next[item.key] = item; });
        return next;
      });
      allContentLoaded.current = true;
      setIsSiteContentLoaded(true);
    } catch (err) {
      console.error('DataContext: fetchAllContent error:', err);
      setIsSiteContentLoaded(true); // unblock UI on error
    }
  }, []);

  // ─── Full refresh (for realtime updates & after admin edits) ─────────────
  const refreshSiteContent = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('key');
      if (error) throw error;
      setSiteContent(prev => {
        const next = { ...prev };
        (data || []).forEach(item => { next[item.key] = item; });
        return next;
      });
      allContentLoaded.current = true;
    } catch (err) {
      console.error('Error refreshing site content:', err);
    }
  }, []);

  // ─── Optimistic local remove (instant UI update before DB confirms) ───────
  const optimisticRemoveContent = useCallback((keys: string | string[]) => {
    const toRemove = new Set(Array.isArray(keys) ? keys : [keys]);
    setSiteContent(prev => {
      const next = { ...prev };
      toRemove.forEach(k => delete next[k]);
      return next;
    });
  }, []);
  const refreshProducts = useCallback(async () => {
    try {
      setLoadingMessage('Henter produkter...');
const { data, error } = await supabase
  .from('products')
  .select('*');
      if (error) throw error;
      setProducts(data || []);
      setIsProductsLoaded(true);
    } catch (err: any) {
      console.error('Error fetching products:', err);
    }
  }, [setLoadingMessage]);

  const refreshHomeSections = useCallback(async () => {
    try {
      setLoadingMessage('Henter sektioner...');
      const { data, error } = await supabase
        .from('home_sections')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      if (error) throw error;
      setHomeSections(data || []);
      setIsHomeSectionsLoaded(true);
    } catch (err: any) {
      console.error('Error fetching home sections:', err);
    }
  }, [setLoadingMessage]);

  const refreshPortfolio = useCallback(async () => {
    try {
      setLoadingMessage('Henter portfolio...');
      const { data, error } = await supabase
        .from('portfolio_images')
        .select(`
          *,
          portfolio_bundles (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPortfolioImages(data || []);
      setIsPortfolioLoaded(true);
    } catch (err: any) {
      console.error('Error fetching portfolio:', err);
    }
  }, [setLoadingMessage]);

  const refreshBundles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_bundles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBundles(data || []);
    } catch (err: any) {
      console.error('Error fetching bundles:', err);
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    if (!user || !isAdmin) {
      setBookings([]);
      setIsBookingsLoaded(true);
      return;
    }
    try {
      setBookingsLoading(true);
      setLoadingMessage('Henter bookinger...');
      const { data, error } = await supabase
             .from('bookings_with_users')   // ← change this line
        .select(`
          *,
          products (
            id,
            name,
            price,
            description
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBookings(data || []);
      setIsBookingsLoaded(true);
      setBookingsError(null);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setBookingsError(err.message);
    } finally {
      setBookingsLoading(false);
    }
  }, [user, isAdmin, setLoadingMessage]);

  const refreshDiscountCodes = useCallback(async () => {
    if (!isAdmin) {
      setIsDiscountCodesLoaded(true);
      return;
    }
    try {
      setLoadingMessage('Henter rabatkoder...');
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDiscountCodes(data || []);
      setIsDiscountCodesLoaded(true);
    } catch (err: any) {
      console.error('Error fetching discount codes:', err);
    }
  }, [isAdmin, setLoadingMessage]);

  const refreshNewsletters = useCallback(async () => {
    if (!isAdmin) {
      setIsNewslettersLoaded(true);
      return;
    }
    try {
      setLoadingMessage('Henter nyhedsbreve...');
      const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .order('sent_at', { ascending: false });
      if (error) throw error;
      setNewsletters(data || []);
      setIsNewslettersLoaded(true);
    } catch (err: any) {
      console.error('Error fetching newsletters:', err);
    }
  }, [isAdmin, setLoadingMessage]);

  const refreshNewsletterSubscribers = useCallback(async () => {
    if (!isAdmin) {
      setIsNewsletterSubscribersLoaded(true);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNewsletterSubscribers(data || []);
      setIsNewsletterSubscribersLoaded(true);
    } catch (err: any) {
      console.error('Error fetching newsletter subscribers:', err);
    }
  }, [isAdmin]);

  const refreshNewsletterTemplates = useCallback(async () => {
    if (!isAdmin) {
      setIsNewsletterTemplatesLoaded(true);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('newsletter_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNewsletterTemplates(data || []);
      setIsNewsletterTemplatesLoaded(true);
    } catch (err: any) {
      console.error('Error fetching newsletter templates:', err);
    }
  }, [isAdmin]);

  const refreshAddressZones = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('address_zones')
        .select('*')
        .order('name');
      if (error) throw error;
      setAddressZones(data || []);
      setIsAddressZonesLoaded(true);
    } catch (err: any) {
      console.error('Error fetching address zones:', err);
    }
  }, []);

  // ─── Initial load ─────────────────────────────────────────────────────────
  // Fire immediately on mount — do NOT wait for auth.
  // Page content (site_content) is public and needs no auth.
  // Admin-gated data fetches handle their own auth checks.
  useEffect(() => {
    if (hasInitiallyLoaded.current) return;
    hasInitiallyLoaded.current = true;

    // Fire single content load immediately — no phases
    fetchAllContent();

    setLoadingProgress(100);
    setLoadingMessage('Klar!');
    setIsDataLoaded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Route change: fetch new page content ─────────────────────────────────
  // Only fires on actual navigation — initial load is handled in initializeApp.
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (!isDataLoaded) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    fetchAllContent();
  }, [location.pathname, isDataLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auth-gated cache invalidation ────────────────────────────────────────
  useEffect(() => {
    if (user?.id !== prevUserId.current) {
      loadedCache.current.clear();
      prevUserId.current = user?.id;
      console.log('DataContext: user changed — invalidated auth-gated cache');
    }
  }, [user?.id]);

  // ─── Auto-fetch page data on route change ─────────────────────────────────
  // Also re-runs when isAdmin changes so admin-gated data is fetched after auth resolves.
  const { isAdmin: isAdminForEffect } = useAuth();
  useEffect(() => {
    if (!isDataLoaded) return;

    const path = location.pathname.replace(/\/$/, '') || '/';

    const getDataKeysForPath = (p: string): PageDataKey[] => {
      if (p === '/')                       return ['homeSections'];
      if (p === '/products')               return ['products'];
      if (p.startsWith('/products/'))      return ['products'];
      if (p.startsWith('/product/'))       return ['products'];
      if (p === '/portfolio')              return ['portfolio', 'bundles'];
      if (p === '/ratings')                return [];
      if (p === '/search')                 return ['products'];
      if (p.startsWith('/booking/'))       return ['products'];
      if (p.startsWith('/payment/'))       return ['bookings'];
      if (p === '/profile')                return ['bookings', 'discountCodes'];
      if (p === '/buy-credits')            return ['discountCodes'];
      if (p === '/coverage')               return ['addressZones'];
      if (p.startsWith('/simple-request')) return ['products'];
      if (p === '/admin')                  return [
        'products', 'portfolio', 'bundles', 'bookings',
        'newsletters', 'newsletterSubscribers', 'newsletterTemplates',
        'discountCodes', 'addressZones',
      ];
      return [];
    };

    const fetchers: Record<PageDataKey, () => Promise<void>> = {
      products:              refreshProducts,
      homeSections:          refreshHomeSections,
      portfolio:             refreshPortfolio,
      bundles:               refreshBundles,
      bookings:              refreshBookings,
      discountCodes:         refreshDiscountCodes,
      newsletters:           refreshNewsletters,
      newsletterSubscribers: refreshNewsletterSubscribers,
      newsletterTemplates:   refreshNewsletterTemplates,
      addressZones:          refreshAddressZones,
    };

    const ADMIN_GATED_KEYS = new Set<PageDataKey>(['bookings', 'discountCodes', 'newsletters', 'newsletterSubscribers', 'newsletterTemplates']);

    const allKeys      = getDataKeysForPath(path);
    // For admin-gated keys, skip the cache when isAdmin is false — they must be re-fetched once auth resolves.
    const keysToFetch  = allKeys.filter(key => {
      if (loadedCache.current.has(key)) {
        // If it's admin-gated and isAdmin just became true, force re-fetch by removing from cache
        if (ADMIN_GATED_KEYS.has(key) && isAdminForEffect && !loadedCache.current.has(key as any)) return true;
        return false;
      }
      return true;
    });
    const cachedKeys   = allKeys.filter(key =>  loadedCache.current.has(key));

    if (cachedKeys.length > 0) {
      console.log(`DataContext: route "${path}" → cache hit for`, cachedKeys);
    }
    if (keysToFetch.length === 0) {
      console.log(`DataContext: route "${path}" → all page data cached`);
      return;
    }

    console.log(`DataContext: route "${path}" → fetching`, keysToFetch);
    keysToFetch.forEach(key => {
      // Only add admin-gated keys to cache when we're actually admin
      if (!ADMIN_GATED_KEYS.has(key) || isAdminForEffect) {
        loadedCache.current.add(key);
      }
      fetchers[key]?.().catch(err => {
        loadedCache.current.delete(key);
        console.error(`DataContext: auto-fetch error for "${key}":`, err);
      });
    });
  }, [location.pathname, isDataLoaded, isAdminForEffect, refreshProducts, refreshHomeSections, refreshPortfolio, refreshBundles,  refreshBookings, refreshDiscountCodes, refreshNewsletters, refreshNewsletterSubscribers, refreshNewsletterTemplates, refreshAddressZones]);

  // ─── Tab-visibility → reconnect realtime ──────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          await supabase.auth.refreshSession();
          setRealtimeKey(prev => prev + 1);
        } catch (err) {
          console.error('DataContext: tab visibility reconnect error:', err);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ─── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!isDataLoaded) return;

    const setupSubscription = (channelName: string, tableName: string, callback: () => void) => {
      try {
        const channel = supabase
          .channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
            console.log(`DataContext: ${channelName} – change detected`);
            callback();
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`DataContext: ${channelName} subscription issue: ${status}`);
            }
          });
        subscriptionRefs.current.set(channelName, channel);
        return channel;
      } catch (err) {
        console.error(`DataContext: Error setting up ${channelName}:`, err);
        return null;
      }
    };

    const subscriptions = [
      setupSubscription('products_changes',      'products',          refreshProducts),
      setupSubscription('site_content_changes',  'site_content',      refreshSiteContent),
      setupSubscription('home_sections_changes', 'home_sections',     refreshHomeSections),
      setupSubscription('portfolio_changes',     'portfolio_images',  refreshPortfolio),
      setupSubscription('bundles_changes',       'portfolio_bundles', refreshBundles),
      setupSubscription('bookings_changes',      'bookings',          refreshBookings),
      setupSubscription('newsletter_changes',    'newsletters',       refreshNewsletters),
      setupSubscription('address_zones_changes', 'address_zones',     refreshAddressZones),
    ].filter(Boolean);

    if (isAdmin) {
      subscriptions.push(
        setupSubscription('newsletter_subscribers_changes', 'newsletter_subscribers', refreshNewsletterSubscribers),
        setupSubscription('newsletter_templates_changes',   'newsletter_templates',   refreshNewsletterTemplates),
      );
    }

    return () => {
      subscriptions.forEach(sub => { if (sub) { try { supabase.removeChannel(sub); } catch {} } });
      subscriptionRefs.current.forEach(channel => { try { supabase.removeChannel(channel); } catch {} });
      subscriptionRefs.current.clear();
    };
  }, [isDataLoaded, isAdmin, realtimeKey, refreshProducts, refreshSiteContent, refreshHomeSections, refreshPortfolio, refreshBundles, refreshBookings,  refreshNewsletters, refreshNewsletterSubscribers, refreshNewsletterTemplates, refreshAddressZones]);

  useEffect(() => {
    if (!user || !isDataLoaded) return;
    setRealtimeKey(prev => prev + 1);
  }, [user?.id, isDataLoaded]);

  // ─── Context value ─────────────────────────────────────────────────────────
  const value: DataContextType = {
    products,
    siteContent,
    getContent,
    getContentItem,
    getContentLoadingState,
    homeSections,
    portfolioImages,
    bundles,
    addressZones,
    bookings,
    bookingsLoading,
    bookingsError,
    discountCodes,
    newsletterSubscribers,
    newsletters,
    newsletterTemplates,
    isDataLoaded,
    dataError,
    isSiteContentLoaded,
    isProductsLoaded,
    isPortfolioLoaded,
    isHomeSectionsLoaded,
    isBookingsLoaded,
    isDiscountCodesLoaded,
    isNewslettersLoaded,
    isNewsletterSubscribersLoaded,
    isNewsletterTemplatesLoaded,
    isAddressZonesLoaded,
    refreshProducts,
    refreshSiteContent,
    optimisticRemoveContent,
    refreshHomeSections,
    refreshPortfolio,
    refreshBundles,
    refreshBookings,
    refreshDiscountCodes,
    refreshNewsletterSubscribers,
    refreshNewsletters,
    refreshNewsletterTemplates,
    refreshAddressZones,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};