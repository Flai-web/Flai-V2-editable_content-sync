import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { ThumbsUp, ThumbsDown, Package, ChevronDown, ChevronUp } from 'lucide-react';
import EditableContent from '../components/EditableContent';
import SEO from '../components/SEO';
import { useData } from '../contexts/DataContext';
import toast from 'react-hot-toast';
import Comments from '../components/Comments';
import { SkeletonLoader } from '../components/SkeletonLoader';

// Portfolio-specific skeleton that matches actual portfolio card dimensions
const PortfolioCardSkeleton: React.FC = () => (
  <div className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700">
    <div className="relative">
      <div className="w-full aspect-video bg-gradient-to-r from-neutral-700 via-neutral-600 to-neutral-700 animate-shimmer bg-[length:200%_100%] rounded-t-lg" />
    </div>
    <div className="p-4">
      <SkeletonLoader height="1.25rem" className="mb-1" width="60%" />
      <SkeletonLoader height="0.875rem" className="mb-3" width="40%" />
      <div className="flex items-center space-x-4">
        <SkeletonLoader width="60px" height="1.25rem" />
        <SkeletonLoader width="60px" height="1.25rem" />
      </div>
    </div>
  </div>
);

interface Bundle {
  id: string;
  name: string;
  created_at: string;
}

const PortfolioPage: React.FC = () => {
  const { user } = useAuth();
  const { portfolioImages, refreshPortfolio, isPortfolioLoaded, getContent } = useData();
  const [loading, setLoading] = useState(false);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_bundles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBundles(data || []);
    } catch (err) {
      console.error('Error loading bundles:', err);
    }
  };

  const toggleBundle = (bundleId: string) => {
    setExpandedBundles(prev => {
      const newSet = new Set(prev);
      newSet.has(bundleId) ? newSet.delete(bundleId) : newSet.add(bundleId);
      return newSet;
    });
  };

  // âââ Pure array-based ordering â no randomness ââââââââââââââââââââââââââââââ
  // Portfolio is a deliberate showcase. Higher array value = always shown first.
  // Order is fully deterministic and only changes when array values are updated.
  const imageKey = portfolioImages.map(i => `${i.id}:${i.array ?? 50}`).join(',');

  const imageScores = useMemo(() => {
    if (portfolioImages.length === 0) return new Map<string, number>();
    const map = new Map<string, number>();
    portfolioImages.forEach(img => {
      map.set(img.id, img.array ?? 50);
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  // Sort all images by their weighted score (descending)
  const sortedImages = useMemo(() => {
    return [...portfolioImages].sort((a, b) => {
      const scoreA = imageScores.get(a.id) ?? 0;
      const scoreB = imageScores.get(b.id) ?? 0;
      return scoreB - scoreA;
    });
  }, [portfolioImages, imageScores]);

  // âââ Reactions ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const handleReaction = async (imageId: string, reaction: 'like' | 'dislike') => {
    if (loading) return;
    try {
      setLoading(true);
      const image = portfolioImages.find(img => img.id === imageId);
      if (!image) return;

      if (user) {
        if (image.user_reaction === reaction) {
          await supabase.from('portfolio_reactions').delete()
            .eq('image_id', imageId).eq('user_id', user.id);
        } else {
          const { data: existing } = await supabase.from('portfolio_reactions').select('*')
            .eq('image_id', imageId).eq('user_id', user.id).maybeSingle();
          if (existing) {
            await supabase.from('portfolio_reactions').update({ reaction }).eq('id', existing.id);
          } else {
            await supabase.from('portfolio_reactions').insert({ image_id: imageId, user_id: user.id, reaction });
          }
        }
      } else {
        let anonymousId = localStorage.getItem('anonymous_user_id');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!anonymousId || !uuidRegex.test(anonymousId)) {
          anonymousId = crypto.randomUUID();
          localStorage.setItem('anonymous_user_id', anonymousId);
        }
        const { data: existing } = await supabase.from('portfolio_reactions').select('*')
          .eq('image_id', imageId).eq('anonymous_id', anonymousId).maybeSingle();
        if (existing && existing.reaction === reaction) {
          await supabase.from('portfolio_reactions').delete()
            .eq('image_id', imageId).eq('anonymous_id', anonymousId);
        } else if (existing) {
          await supabase.from('portfolio_reactions').update({ reaction }).eq('id', existing.id);
        } else {
          await supabase.from('portfolio_reactions').insert({ image_id: imageId, anonymous_id: anonymousId, reaction });
        }
      }
      await refreshPortfolio();
    } catch (err) {
      console.error('Error updating reaction:', err);
      toast.error('Kunne ikke opdatere reaktion');
    } finally {
      setLoading(false);
    }
  };

  // âââ Render helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const renderMedia = (image: any) => {
    if (image.image_url.startsWith('youtube:')) {
      const videoId = image.image_url.split(':')[1];
      return (
        <div className="relative w-full pt-[56.25%]">
          <iframe
            className="absolute inset-0 w-full h-full rounded-lg"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <img
        src={image.image_url}
        alt={image.title}
        className="w-full aspect-video object-cover rounded-lg"
      />
    );
  };

  const renderImageCard = (image: any) => (
    <div key={image.id} className="bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700">
      <div className="relative">{renderMedia(image)}</div>
      <div className="p-4">
        <h3 className="font-medium mb-1">{image.title}</h3>
        {image.image_name && <p className="text-sm text-neutral-400 mb-3">{image.image_name}</p>}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => handleReaction(image.id, 'like')}
            disabled={loading}
            className={`flex items-center space-x-1 ${image.user_reaction === 'like' ? 'text-primary' : 'text-neutral-400 hover:text-white'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ThumbsUp size={18} />
            <span>{image.likes}</span>
          </button>
          <button
            onClick={() => handleReaction(image.id, 'dislike')}
            disabled={loading}
            className={`flex items-center space-x-1 ${image.user_reaction === 'dislike' ? 'text-error' : 'text-neutral-400 hover:text-white'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ThumbsDown size={18} />
            <span>{image.dislikes}</span>
          </button>
        </div>
      </div>
    </div>
  );

  // âââ Grid items ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const renderGrid = () => {
    const renderedBundles = new Set<string>();

    return sortedImages.map((image) => {
      // ââ Bundled image ââ
      if (image.bundle_id) {
        if (renderedBundles.has(image.bundle_id)) return null;
        renderedBundles.add(image.bundle_id);

        const bundle = bundles.find(b => b.id === image.bundle_id);
        const bundleImages = sortedImages.filter(img => img.bundle_id === image.bundle_id);
        const isExpanded = expandedBundles.has(image.bundle_id);

        if (!isExpanded) {
          return (
            <div key={`bundle-${image.bundle_id}`} className="relative pb-8 pr-8">
              <div className="relative cursor-pointer group" onClick={() => toggleBundle(image.bundle_id!)}>
                {bundleImages.length > 2 && bundleImages[2] && (
                  <div className="absolute inset-0 rounded-xl border-2 border-neutral-600 transform translate-x-6 translate-y-6 transition-all duration-300 group-hover:translate-x-8 group-hover:translate-y-8 overflow-hidden origin-top-left">
                    {bundleImages[2].image_url.startsWith('youtube:') ? (
                      <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                        <svg className="w-12 h-12 text-neutral-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                        </svg>
                      </div>
                    ) : (
                      <img src={bundleImages[2].image_url} alt="" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/40 via-neutral-900/50 to-neutral-900/60" />
                  </div>
                )}
                {bundleImages.length > 1 && bundleImages[1] && (
                  <div className="absolute inset-0 rounded-xl border-2 border-neutral-600 transform translate-x-3 translate-y-3 transition-all duration-300 group-hover:translate-x-4 group-hover:translate-y-4 overflow-hidden origin-top-left">
                    {bundleImages[1].image_url.startsWith('youtube:') ? (
                      <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                        <svg className="w-12 h-12 text-neutral-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                        </svg>
                      </div>
                    ) : (
                      <img src={bundleImages[1].image_url} alt="" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/30 via-neutral-900/40 to-neutral-900/50" />
                  </div>
                )}
                <div className="relative bg-neutral-800 rounded-xl overflow-hidden border-2 border-neutral-600 transition-all duration-300">
                  <div className="relative">
                    {renderMedia(bundleImages[0])}
                    <div className="absolute top-3 right-3 bg-neutral-900/90 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center space-x-2 border border-neutral-600">
                      <Package size={16} className="text-neutral-300" />
                      <span className="text-sm font-medium">{bundleImages.length}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package size={16} className="text-neutral-300" />
                        <h3 className="font-semibold">{bundle?.name || 'Bundle'}</h3>
                      </div>
                      <button className="text-neutral-300 hover:text-white text-sm font-medium flex items-center">
                        Se alle <ChevronDown size={16} className="ml-1" />
                      </button>
                    </div>
                    <p className="text-sm text-neutral-400 mt-1">
                      {bundleImages.length} {bundleImages.length === 1 ? 'billede' : 'billeder'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Expanded bundle
        return (
          <React.Fragment key={`bundle-${image.bundle_id}`}>
            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <div
                className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 cursor-pointer hover:from-primary/15 hover:to-primary/10 transition-all border-2 border-primary/30"
                onClick={() => toggleBundle(image.bundle_id!)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <ChevronUp size={24} className="text-primary" />
                    <Package size={24} className="text-primary" />
                    <div>
                      <h3 className="text-xl font-semibold">{bundle?.name || 'Bundle'}</h3>
                      <p className="text-neutral-400 text-sm">
                        {bundleImages.length} {bundleImages.length === 1 ? 'billede' : 'billeder'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <ThumbsUp size={16} className="text-success" />
                      <span className="text-neutral-300">{bundleImages.reduce((s, i) => s + i.likes, 0)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ThumbsDown size={16} className="text-error" />
                      <span className="text-neutral-300">{bundleImages.reduce((s, i) => s + i.dislikes, 0)}</span>
                    </div>
                    <button className="text-primary hover:text-primary/80 font-medium">Luk</button>
                  </div>
                </div>
              </div>
            </div>
            {bundleImages.map((bundleImage, index) => (
              <div
                key={bundleImage.id}
                className="animate-in fade-in slide-in-from-top-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
              >
                <div className="relative">
                  <div className="absolute -inset-1 bg-primary/10 rounded-xl" />
                  <div className="relative border-2 border-primary/40 rounded-xl overflow-hidden">
                    {renderImageCard(bundleImage)}
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        );
      }

      // ââ Individual image ââ
      return renderImageCard(image);
    });
  };

  return (
    <div className="pt-20 pb-16">
      <SEO
        title={getContent('portfolio-page-title', "Vores arbejde")}
        description="Se eksempler pÃ¥ vores dronefotografering og dronefilmning. Flai leverer professionelle luftoptagelser i hele Danmark."
        canonical="/portfolio"
      />
      <div className="bg-primary/10 py-12 mb-12">
        <div className="container">
          <EditableContent
            contentKey="portfolio-page-title"
            as="h1"
            className="text-3xl md:text-4xl font-bold text-center mb-4"
            fallback="Vores arbejde"
          />
          <EditableContent
            contentKey="portfolio-page-subtitle"
            as="p"
            className="text-center text-lg text-neutral-300 max-w-2xl mx-auto"
            fallback="Udforsk vores seneste film og projekter."
          />
        </div>
      </div>
      <div className="container">

        {!isPortfolioLoaded ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => <PortfolioCardSkeleton key={i} />)}
          </div>
        ) : portfolioImages.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">
            <EditableContent
              contentKey="portfolio-no-images"
              as="p"
              fallback="Ingen portfolio billeder fundet endnu."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {renderGrid()}
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioPage;