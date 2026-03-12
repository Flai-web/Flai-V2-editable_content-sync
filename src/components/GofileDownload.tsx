import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, Download, Home, Share2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import EditableContent from './EditableContent';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const GofileDownload: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [bypassUrl, setBypassUrl] = useState<string>('');
  const [shareProjectUrl, setShareProjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }

    const init = async () => {
      // Construct the bypass URL
      const url = `https://gf.1drv.eu.org/${id}`;
      setBypassUrl(url);
      
      // Construct the current page URL
      const currentPageUrl = window.location.href;
      
      // Query the database to find the booking with this zip_file_url
      // Then check if that booking has a non-null share_project_url
      try {
        const { data: booking, error } = await supabase
          .from('bookings')
          .select('share_project_url')
          .eq('zip_file_url', currentPageUrl)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching booking:', error);
        } else if (booking && booking.share_project_url) {
          setShareProjectUrl(booking.share_project_url);
        }
      } catch (err) {
        console.error('Error checking for share project:', err);
      }
      
      setStatus('ready');
    };

    init();
  }, [id, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <Download size={48} className="mx-auto mb-4 animate-bounce text-primary" />
          <EditableContent
            contentKey="gofile-loading-title"
            as="h1"
            className="text-2xl font-bold text-white mb-2"
            fallback="Indlæser..."
          />
          <Loader size={24} className="mx-auto animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <Download size={48} className="mx-auto mb-4 text-primary" />
        <EditableContent
          contentKey="gofile-ready-title"
          as="h1"
          className="text-2xl font-bold text-white mb-2"
          fallback="Klar til download"
        />
        <EditableContent
          contentKey="gofile-ready-description"
          as="p"
          className="text-neutral-300 mb-6"
          fallback="Klik på knappen nedenfor for at downloade dine filer."
        />
        
        <div className="flex flex-col gap-3">
          <a     
            href={bypassUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Download size={20} />
            <EditableContent
              contentKey="gofile-download-button"
              as="span"
              fallback="Download fil"
            />
          </a>
          
          {shareProjectUrl && (
            <a
              href={shareProjectUrl.startsWith('http') ? shareProjectUrl : `https://${shareProjectUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-neutral-700 hover:bg-neutral-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <Share2 size={20} />
              <EditableContent
                contentKey="gofile-share-button"
                as="span"
                fallback="Del"
              />
            </a>
          )}
          
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 bg-neutral-700 hover:bg-neutral-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Home size={20} />
            <EditableContent
              contentKey="gofile-home-button"
              as="span"
              fallback="Til forside"
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GofileDownload;