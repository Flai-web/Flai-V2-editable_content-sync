import React, { useState, useEffect, useRef } from 'react';
import RatingStars from '../components/RatingStars';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import EditableContent from '../components/EditableContent';
import SEO from '../components/SEO';
import { useData } from '../contexts/DataContext';

const RatingsPage: React.FC = () => {
  const { ratings, getContent } = useData();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(1250);

  // Listen for height messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data.height === 'number') {
        setIframeHeight(event.data.height + 20);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="pt-20 pb-16 bg-neutral-900">
      <SEO
        title={getContent('ratings-page-title', "Alle Anmeldelser")}
        description="Se hvad vores kunder siger om Flai droneservice. Læs anmeldelser og bedømmelser fra tidligere kunder."
        canonical="/ratings"
      />
      <div className="bg-primary/10 py-12 mb-12">
        <div className="container">
          <EditableContent
            contentKey="ratings-page-title"
            as="h1"
            className="text-3xl md:text-4xl font-bold text-center mb-4"
            fallback="Alle Anmeldelser"
          />
          <EditableContent
            contentKey="ratings-page-subtitle"
            as="p"
            className="text-center text-lg text-neutral-300 max-w-2xl mx-auto"
            fallback="Hvad siger vores kunder. Vi er stolte af vores anmeldelser og arbejder altid på at levere det bedste resultat."
          />
        </div>
      </div>

      <div className="container">
        <div className="mb-16 px-4 sm:px-0 flex justify-center">
          <div className="w-full sm:w-[100%] md:w-full">
            <iframe
              ref={iframeRef}
              src="/review-20.html"
              className="w-full transition-all duration-300"
              style={{
                height: `${iframeHeight}px`,
                border: 'none',
                background: 'transparent',
                overflow: 'hidden'
              }}
              title="Google Anmeldelser"
              scrolling="no"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RatingsPage;