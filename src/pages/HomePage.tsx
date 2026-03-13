import '../utils/heroPreload'
import React, { lazy, Suspense } from 'react';
import SEO from '../components/SEO';
import { useNavigate } from 'react-router-dom';
import { Video, Camera, MapPin, Star } from 'lucide-react';
import HeroVideoSection from '../components/HeroVideoSection';
import EditableContent from '../components/EditableContent';
import CodeProjectRenderer from '../components/CodeProjectRenderer';
import { useData } from '../contexts/DataContext';

const Testimonials = lazy(() => import('../components/Testimonials'));

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { getContent, homeSections, isSiteContentLoaded } = useData();

  const heroLogo = getContent('site-logo', "https://pbqeljimuerxatrtmgsn.supabase.co/storage/v1/object/public/site-content/1773294006709-bc63a5b4.webp");
  const heroSubtitle = getContent('hero-subtitle', "Drone service i Syddanmark. 100% garanti.");
  const contactEmail = getContent('contact-email', "fb@flai.dk");
  const contactPhone = getContent('contact-phone', "+45 27 29 21 99");

  // Pass the fallback URL directly so HeroVideoSection renders on frame 1.
  // heroPreload.ts already fetched the real URL from the DB before React loaded ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ
  // the videoUrl prop here is only used as a fallback if heroPreload failed.
  // Do NOT use getContent() here ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ it returns '' until isSiteContentLoaded,
  // which would delay HeroVideoSection mounting by 300-500ms.
  const heroVideoUrl = '';

  return (
    <div className="bg-neutral-900">
      <SEO
        canonical="/"
        description={heroSubtitle}
        schema={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": "https://flai.dk/#business",
          "name": "Flai",
          "description": heroSubtitle,
          "url": "https://flai.dk",
          "logo": heroLogo,
          "telephone": contactPhone,
          "email": contactEmail,
          "address": { "@type": "PostalAddress", "addressCountry": "DK" },
          "areaServed": { "@type": "Country", "name": "Danmark" }
        }}
      />
      <HeroVideoSection videoUrl={heroVideoUrl}>
        {/* Hero content loads independently - HeroVideoSection renders immediately */}
        <div className="mb-6 text-white drop-shadow-2xl">
          <div className="flex flex-col items-center">
            <img
              src={heroLogo}
              alt="Flai.dk"
              width="160"
              height="64"
              className="h-16 md:h-16 w-auto transition-all duration-500"
            />
          </div>
        </div>
        <div className="text-xl mb-8 text-neutral-100 drop-shadow-lg">
          <EditableContent
            contentKey="hero-subtitle"
            fallback="Drone service i Syddanmark. 100% garanti."
          />
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button onClick={() => navigate('/products')} className="btn-primary text-lg px-8 py-4">
            <EditableContent contentKey="hero-button-primary" fallback="Se Vores Tjenester" />
          </button>
          <button onClick={() => navigate('/ratings')} className="btn-secondary text-lg px-8 py-4 flex items-center justify-center">
            <Star size={20} className="mr-2" />
            <EditableContent contentKey="hero-button-secondary" fallback="Se Anmeldelser" />
          </button>
        </div>

      </HeroVideoSection>

      {homeSections.filter(s => s.is_active).map((section, index) => (
        <section key={section.id} className="py-20 bg-neutral-800">
          <div className="container">
            {section.section_type === 'code' ? (
              <div className="max-w-6xl mx-auto">
                <CodeProjectRenderer files={section.code_files || []} />
              </div>
            ) : (
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'md:grid-flow-col-dense' : ''}`}>
                <div className={index % 2 === 1 ? 'md:order-2' : ''}>
                  <h2 className="text-3xl font-bold mb-6 text-white">{section.title}</h2>
                  <p className="text-neutral-300 mb-8">{section.description}</p>
                </div>
                <div className={`relative ${index % 2 === 1 ? 'md:order-1' : ''}`}>
                  <img src={section.image_url} alt={section.title} className="rounded-lg shadow-xl w-full h-auto aspect-video object-cover" />
                </div>
              </div>
            )}
          </div>
        </section>
      ))}

      {homeSections.length === 0 && isSiteContentLoaded && (
        <section className="py-20 bg-neutral-800">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <EditableContent contentKey="drone-section-title" as="h2" className="text-3xl font-bold mb-6 text-white" fallback="DJI Mini 3 Pro Drone" />
                <EditableContent contentKey="drone-section-description" as="p" className="text-neutral-300 mb-8" fallback="Med vores DJI Mini 3 Pro drone leverer vi exceptionel billedkvalitet og stabilitet. Perfekt til ejendomsvisninger, events og personlige projekter." />
                <ul className="space-y-4 text-neutral-300">
                  <li className="flex items-center"><Video className="text-primary mr-3" size={24} /><EditableContent contentKey="drone-feature-video" fallback="4K/60fps videooptagelse" /></li>
                  <li className="flex items-center"><Camera className="text-primary mr-3" size={24} /><EditableContent contentKey="drone-feature-photo" fallback="48MP stillbilleder" /></li>
                  <li className="flex items-center"><MapPin className="text-primary mr-3" size={24} /><EditableContent contentKey="drone-feature-coverage" fallback="DÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¦kker hele omrÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¥der i Danmark" /></li>
                </ul>
              </div>
              <div className="relative">
                <EditableContent contentKey="drone-section-image" as="img" className="rounded-lg shadow-xl" alt="DJI Mini 3 Pro Drone" fallback="/Drone.png" />
              </div>
            </div>
          </div>
        </section>
      )}

      <Suspense fallback={null}><Testimonials /></Suspense>

      <section className="py-20 bg-neutral-800">
        <div className="container text-center">
          <EditableContent contentKey="cta-title" as="h2" className="text-3xl md:text-4xl font-bold mb-6 text-white" fallback="Klar til en ny verden fra oven?" />
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
            <button onClick={() => navigate('/products')} className="btn-primary text-lg px-8 py-4">
              <EditableContent contentKey="cta-button-primary" fallback="Se Priser og Book" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;