import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Package,
  Image,
  MapPin,
  Tag,
  Home,
  Clock,
  Mail,
  FileImage,
  Heart,
  Video,
  Search,
  Users,
  GitBranch,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import EditableContent from '../components/EditableContent';
import ErrorBoundary from '../components/ErrorBoundary';
import HomeSectionsManager from '../components/HomeSectionsManager';
import ProductsManager from '../components/admin/ProductsManager';
import PortfolioManager from '../components/admin/PortfolioManager';
import AddressZonesManager from '../components/admin/AddressZonesManager';
import DiscountCodesManager from '../components/admin/DiscountCodesManager';
import BookingsManager from '../components/admin/BookingsManager';
import NewsletterManager from '../components/admin/NewsletterManager';
import BookingConfigManager from '../components/admin/BookingConfigManager';
import ExternalImagesManager from '../components/admin/ExternalImagesManager';
import DonationsManager from '../components/admin/DonationsManager';
import VideoManager from '../components/admin/VideoManager';
import MeilisearchManager from '../components/admin/MeilisearchManager';
import AdminUsersPanel from '../components/admin/AdminUsersPanel';
import DeployContentManager from '../components/admin/DeployContentManager';

type TabId =
  | 'bookings'
  | 'booking-config'
  | 'products'
  | 'portfolio'
  | 'zones'
  | 'discounts'
  | 'home-sections'
  | 'newsletter'
  | 'external-images'
  | 'donations'
  | 'video'
  | 'meilisearch'
  | 'users'
  | 'deploy';

const VALID_SECTIONS = new Set<TabId>([
  'bookings', 'booking-config', 'products', 'portfolio',
  'zones', 'discounts', 'home-sections', 'newsletter',
  'external-images', 'donations', 'video', 'users', 'deploy',
]);

const DEFAULT_TAB: TabId = 'bookings';

const AdminPage: React.FC = () => {
  const { isAdmin, loading, profileLoading } = useAuth();
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();

  const {
    products, portfolioImages, addressZones, discountCodes, bookings,
    refreshProducts, refreshPortfolio, refreshBundles, refreshBookings,
    refreshDiscountCodes, refreshNewsletters, refreshNewsletterSubscribers, refreshNewsletterTemplates,
    refreshAddressZones,
    isProductsLoaded, isPortfolioLoaded, isBookingsLoaded,
    isDiscountCodesLoaded, isNewslettersLoaded, isNewsletterSubscribersLoaded, isNewsletterTemplatesLoaded,
    isAddressZonesLoaded,
  } = useData();

  const activeTab: TabId =
    section && VALID_SECTIONS.has(section as TabId)
      ? (section as TabId)
      : DEFAULT_TAB;

  useEffect(() => {
    if (!section) {
      navigate(`/admin/${DEFAULT_TAB}`, { replace: true });
    } else if (!VALID_SECTIONS.has(section as TabId)) {
      navigate(`/admin/${DEFAULT_TAB}`, { replace: true });
    }
  }, [section, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!isProductsLoaded) refreshProducts();
    if (!isPortfolioLoaded) { refreshPortfolio(); refreshBundles(); }
    if (!isBookingsLoaded) refreshBookings();
    if (!isDiscountCodesLoaded) refreshDiscountCodes();
    if (!isNewslettersLoaded) refreshNewsletters();
    if (!isNewsletterSubscribersLoaded) refreshNewsletterSubscribers();
    if (!isNewsletterTemplatesLoaded) refreshNewsletterTemplates();
    if (!isAddressZonesLoaded) refreshAddressZones();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  console.log('AdminPage: Rendering with isAdmin:', isAdmin);
  console.log('AdminPage: Data loaded - bookings:', bookings.length, 'products:', products.length);

  if (loading || profileLoading) {
    return (
      <div className="pt-24 pb-16 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-neutral-400">
          <div className="w-10 h-10 border-4 border-neutral-600 border-t-primary rounded-full animate-spin" />
          <span className="text-sm"><EditableContent contentKey="admin-page-checker-adgang" fallback="Checker adgang…" /></span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="pt-24 pb-16 min-h-screen">
        <div className="container max-w-md mx-auto">
          <div className="bg-neutral-800 rounded-xl shadow-md p-8 text-center">
            <EditableContent
              contentKey="admin-access-denied-title"
              as="h1"
              className="text-2xl font-bold mb-4"
              fallback="Adgang nægtet"
            />
            <EditableContent
              contentKey="admin-access-denied-message"
              as="p"
              className="text-neutral-400"
              fallback="Du har ikke tilladelse til at se denne side."
            />
          </div>
        </div>
      </div>
    );
  }

  // label is () => React.ReactElement so it can render <EditableContent />.
  // The key MUST use tab.id (a stable string), never tab.label() (a component).
  const tabs: { id: TabId; label: () => React.ReactElement; icon: React.ElementType }[] = [
    { id: 'bookings',        label: () => <EditableContent contentKey="admin-page-bookinger" fallback="Bookinger" />,                          icon: Calendar  },
    { id: 'booking-config',  label: () => <EditableContent contentKey="admin-page-ugentlige-tilgaengligheder" fallback="Ugentlige tilgængligheder" />, icon: Clock     },
    { id: 'products',        label: () => <EditableContent contentKey="admin-page-produkter" fallback="Produkter" />,                          icon: Package   },
    { id: 'portfolio',       label: () => <EditableContent contentKey="admin-page-portfolio" fallback="Portfolio" />,                          icon: Image     },
    { id: 'external-images', label: () => <EditableContent contentKey="admin-page-eksterne-billeder" fallback="Eksterne Billeder" />,          icon: FileImage },
    { id: 'zones',           label: () => <EditableContent contentKey="admin-page-adressezoner" fallback="Adressezoner" />,                    icon: MapPin    },
    { id: 'discounts',       label: () => <EditableContent contentKey="admin-page-rabatkoder" fallback="Rabatkoder" />,                        icon: Tag       },
    { id: 'donations',       label: () => <EditableContent contentKey="admin-page-donationer" fallback="Donationer" />,                        icon: Heart     },
    { id: 'newsletter',      label: () => <EditableContent contentKey="admin-page-nyhedsbreve" fallback="Nyhedsbreve" />,                      icon: Mail      },
    { id: 'video',           label: () => <EditableContent contentKey="admin-page-videoer" fallback="Videoer" />,                              icon: Video     },
    { id: 'home-sections',   label: () => <EditableContent contentKey="admin-page-forside-sektioner" fallback="Forside Sektioner" />,          icon: Home      },
    { id: 'users',           label: () => <EditableContent contentKey="admin-page-brugere" fallback="Brugere" />,                              icon: Users     },
    { id: 'deploy',          label: () => <EditableContent contentKey="admin-page-deploy-til-github" fallback="Deploy til GitHub" />,          icon: GitBranch },
  ];

  const renderTabContent = () => {
    console.log('AdminPage: Rendering tab content for:', activeTab);
    switch (activeTab) {
      case 'bookings':        return <ErrorBoundary><BookingsManager /></ErrorBoundary>;
      case 'booking-config':  return <ErrorBoundary><BookingConfigManager /></ErrorBoundary>;
      case 'products':        return <ErrorBoundary><ProductsManager /></ErrorBoundary>;
      case 'portfolio':       return <ErrorBoundary><PortfolioManager /></ErrorBoundary>;
      case 'zones':           return <ErrorBoundary><AddressZonesManager /></ErrorBoundary>;
      case 'discounts':       return <ErrorBoundary><DiscountCodesManager /></ErrorBoundary>;
      case 'newsletter':      return <ErrorBoundary><NewsletterManager /></ErrorBoundary>;
      case 'external-images': return <ErrorBoundary><ExternalImagesManager /></ErrorBoundary>;
      case 'home-sections':   return <ErrorBoundary><HomeSectionsManager /></ErrorBoundary>;
      case 'donations':       return <ErrorBoundary><DonationsManager /></ErrorBoundary>;
      case 'video':           return <ErrorBoundary><VideoManager /></ErrorBoundary>;
      case 'users':           return <ErrorBoundary><AdminUsersPanel /></ErrorBoundary>;
      case 'deploy':          return <ErrorBoundary><DeployContentManager /></ErrorBoundary>;
      default:                return null;
    }
  };

  return (
    <div className="pt-24 pb-16 min-h-screen">
      <div className="container">
        <div className="max-w-7xl mx-auto">
          <EditableContent
            contentKey="admin-page-title"
            as="h1"
            className="text-3xl font-bold mb-8"
            fallback="Admin Panel"
          />

          {/* Tab Navigation */}
          <div className="bg-neutral-800 rounded-xl shadow-md overflow-hidden border border-neutral-700 mb-8">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      console.log('AdminPage: Switching to tab:', tab.id);
                      navigate(`/admin/${tab.id}`);
                    }}
                    className={`flex items-center space-x-2 px-6 py-4 whitespace-nowrap font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-primary border-b-2 border-primary bg-neutral-700/50'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-700/30'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{tab.label()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-neutral-800 rounded-xl shadow-md p-6 border border-neutral-700">
            <ErrorBoundary>
              {renderTabContent()}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
