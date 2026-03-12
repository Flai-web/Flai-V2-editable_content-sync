import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PageSkeleton - Progressive skeleton with staggered animations
 * 
 * This skeleton:
 * 1. Matches the EXACT structure of each page
 * 2. Elements fade in progressively (not all at once)
 * 3. Zero performance impact - pure CSS, no JS overhead
 * 4. Disappears instantly when real page loads
 */

const PageSkeleton = () => {
  const location = useLocation();
  const path = location.pathname;

  // Animation delays for progressive appearance
  const delay = (index: number) => ({ animationDelay: `${index * 100}ms` });

  // Header skeleton — position: fixed to match the real NavBar exactly.
  // The real NavBar is also fixed, so this takes zero flow space and causes
  // no layout shift when Suspense swaps skeleton → real page.
  const HeaderSkeleton = () => (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 50,
      backgroundColor: '#171717',
      padding: '12px 0',
    }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-32 bg-neutral-800 rounded animate-pulse-slow" />
          <div className="hidden md:flex gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 w-20 bg-neutral-800 rounded animate-pulse-slow" style={delay(i)} />
            ))}
          </div>
          <div className="h-8 w-8 bg-neutral-800 rounded md:hidden animate-pulse-slow" />
        </div>
      </div>
    </div>
  );

  // Homepage Hero - uses the actual poster image so the Suspense swap is seamless.
  // When Suspense replaces this skeleton with HeroVideoSection, both show the same
  // poster image so the hard DOM swap is visually invisible.
  const POSTER_URL = `https://res.cloudinary.com/dq6jxbyrg/video/upload/c_fill,g_auto,w_1920,so_0/f_auto/q_auto/herovideo.webp`
  const HomeHeroSkeleton = () => (
    <div className="relative h-screen w-full overflow-hidden flex items-end justify-center pb-8 md:pb-32" style={{ backgroundColor: '#111' }}>
      {/* Same poster as HeroVideoSection — seamless handoff on Suspense swap */}
      <img
        src={POSTER_URL}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      />
      
      {/* Gradient overlay — matches HeroVideoSection */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Hero content placeholders — reserves the exact space the real content occupies,
          preventing layout shift when Suspense swaps skeleton → real page */}
      <div className="relative z-10 text-center max-w-3xl mx-auto px-4 space-y-6">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-48 rounded animate-pulse-slow" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="h-6 w-96 max-w-full mx-auto rounded animate-pulse-slow" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
          {/* Matches btn-primary — solid blue */}
          <div className="h-14 w-full sm:w-52 rounded-lg animate-pulse-slow" style={{ background: '#0F52BA' }} />
          {/* Matches btn-secondary — dark with border */}
          <div className="h-14 w-full sm:w-52 rounded-lg animate-pulse-slow" style={{ background: '#262626', border: '1px solid #404040' }} />
        </div>
      </div>
    </div>
  );

  // Feature section - matches the two-column layout
  const FeatureSectionSkeleton = ({ reverse = false }: { reverse?: boolean }) => (
    <section className="py-20 bg-neutral-800">
      <div className="container mx-auto px-4">
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center ${reverse ? 'md:grid-flow-col-dense' : ''}`}>
          {/* Text content */}
          <div className={`space-y-6 ${reverse ? 'md:order-2' : ''}`}>
            <div 
              className="h-9 w-64 bg-neutral-700 rounded animate-pulse-slow"
              style={delay(0)}
            />
            <div className="space-y-3">
              <div 
                className="h-4 bg-neutral-700 rounded animate-pulse-slow"
                style={delay(1)}
              />
              <div 
                className="h-4 bg-neutral-700 rounded w-11/12 animate-pulse-slow"
                style={delay(2)}
              />
              <div 
                className="h-4 bg-neutral-700 rounded w-10/12 animate-pulse-slow"
                style={delay(3)}
              />
            </div>
            {/* Feature list items */}
            <div className="space-y-4 mt-6">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="flex items-center gap-3"
                  style={delay(4 + i)}
                >
                  <div className="h-6 w-6 bg-neutral-700 rounded-full animate-pulse-slow" />
                  <div className="h-4 flex-1 bg-neutral-700 rounded animate-pulse-slow" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Image */}
          <div className={reverse ? 'md:order-1' : ''}>
            <div 
              className="h-64 md:h-80 bg-neutral-700 rounded-lg shadow-xl animate-pulse-slow"
              style={delay(reverse ? 7 : 0)}
            />
          </div>
        </div>
      </div>
    </section>
  );

  // CTA section - matches the bottom call-to-action
  const CTASkeleton = () => (
    <section className="py-20 bg-neutral-800">
      <div className="container mx-auto px-4 text-center space-y-8">
        <div 
          className="h-10 w-96 max-w-full mx-auto bg-neutral-700 rounded animate-pulse-slow"
          style={delay(0)}
        />
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
          <div 
            className="h-14 w-full sm:w-52 mx-auto bg-neutral-700 rounded-lg animate-pulse-slow"
            style={delay(1)}
          />
          <div 
            className="h-14 w-full sm:w-52 mx-auto bg-neutral-700 rounded-lg animate-pulse-slow"
            style={delay(2)}
          />
        </div>
      </div>
    </section>
  );

  // Products grid skeleton
  const ProductsGridSkeleton = () => (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i}
            className="bg-neutral-800 rounded-lg overflow-hidden animate-pulse-slow"
            style={delay(i)}
          >
            <div className="h-48 bg-neutral-700" />
            <div className="p-4 space-y-3">
              <div className="h-6 bg-neutral-700 rounded w-3/4" />
              <div className="h-4 bg-neutral-700 rounded" />
              <div className="h-4 bg-neutral-700 rounded w-5/6" />
              <div className="h-10 bg-neutral-700 rounded mt-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Portfolio grid (2 columns)
  const PortfolioGridSkeleton = () => (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div 
            key={i}
            className="animate-pulse-slow"
            style={delay(i)}
          >
            <div className="h-64 bg-neutral-800 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );

  // Form skeleton
  const FormSkeleton = () => (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="bg-neutral-800 rounded-lg p-8 space-y-6">
        <div 
          className="h-8 w-48 bg-neutral-700 rounded mx-auto animate-pulse-slow"
          style={delay(0)}
        />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} style={delay(i)}>
              <div className="h-4 w-24 bg-neutral-700 rounded mb-2 animate-pulse-slow" />
              <div className="h-10 bg-neutral-700 rounded animate-pulse-slow" />
            </div>
          ))}
        </div>
        <div 
          className="h-12 bg-neutral-700 rounded animate-pulse-slow"
          style={delay(4)}
        />
      </div>
    </div>
  );

  // Product detail skeleton
  const ProductDetailSkeleton = () => (
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div 
          className="h-96 bg-neutral-800 rounded-lg animate-pulse-slow"
          style={delay(0)}
        />
        <div className="space-y-6">
          <div 
            className="h-10 w-3/4 bg-neutral-800 rounded animate-pulse-slow"
            style={delay(1)}
          />
          <div 
            className="h-8 w-32 bg-neutral-800 rounded animate-pulse-slow"
            style={delay(2)}
          />
          <div className="space-y-2">
            <div 
              className="h-4 bg-neutral-800 rounded animate-pulse-slow"
              style={delay(3)}
            />
            <div 
              className="h-4 bg-neutral-800 rounded w-11/12 animate-pulse-slow"
              style={delay(4)}
            />
          </div>
          <div 
            className="h-12 bg-neutral-700 rounded-lg animate-pulse-slow"
            style={delay(5)}
          />
        </div>
      </div>
    </div>
  );

  // Route-specific skeleton rendering
  const renderSkeleton = () => {
    // Homepage - exact structure match
    if (path === '/') {
      return (
        <>
          <HomeHeroSkeleton />
          <FeatureSectionSkeleton />
          <CTASkeleton />
        </>
      );
    }

    // Products page
    if (path === '/products') {
      return (
        <>
          <div className="bg-neutral-900 py-8">
            <div className="container mx-auto px-4">
              <div 
                className="h-10 w-64 bg-neutral-800 rounded mb-4 animate-pulse-slow"
                style={delay(0)}
              />
              <div 
                className="h-5 w-96 max-w-full bg-neutral-800 rounded animate-pulse-slow"
                style={delay(1)}
              />
            </div>
          </div>
          <ProductsGridSkeleton />
        </>
      );
    }

    // Portfolio page
    if (path === '/portfolio') {
      return (
        <>
          <div className="bg-neutral-900 py-8">
            <div className="container mx-auto px-4 text-center">
              <div 
                className="h-10 w-48 bg-neutral-800 rounded mx-auto animate-pulse-slow"
                style={delay(0)}
              />
            </div>
          </div>
          <PortfolioGridSkeleton />
        </>
      );
    }

    // Product detail
    if (path.startsWith('/product/')) {
      return <ProductDetailSkeleton />;
    }

    // Auth/Form pages
    if (['/auth', '/login', '/reset-password', '/update-password', '/booking'].some(p => path.startsWith(p))) {
      return <FormSkeleton />;
    }

    // Default: simple content skeleton
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="space-y-6 max-w-4xl">
          <div 
            className="h-10 w-64 bg-neutral-800 rounded animate-pulse-slow"
            style={delay(0)}
          />
          <div 
            className="h-64 bg-neutral-800 rounded-lg animate-pulse-slow"
            style={delay(1)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-neutral-900 ${path === '/' ? '' : 'pt-16'}`}>
      {renderSkeleton()}
      
      {/* Custom CSS for slower, smoother pulse animation */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default PageSkeleton;