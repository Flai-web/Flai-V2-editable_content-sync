import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { DataProvider } from './contexts/DataContext';
import ColorSystemProvider from './components/ColorSystemProvider';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import ContentManagementPanel from './components/ContentManagementPanel';
import { useAppInitialization } from './hooks/useAppInitialization';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Analyse from './utils/Analyse';
import { useRoutePreloader } from './hooks/useRoutePreloader';
import PageSkeleton from './components/PageSkeletonProgressive';

/**
 * ALL PAGES ARE LAZY LOADED
 *
 * Why this feels instant:
 * 1. NavBar renders immediately — no auth gate. It shows logged-out state while
 *    Supabase resolves the session (~200ms), then updates in place. Zero layout shift.
 * 2. Suspense fallback is null — the page content area is simply empty (same dark bg
 *    as body) while the JS chunk downloads. No skeleton flash, no white screen.
 * 3. index.html body has bg-neutral-900 (#171717) set inline so there is never a
 *    white flash before React mounts.
 * 4. DB content fills in silently in-place once loaded.
 */

const HomePage = lazy(() => import('./pages/HomePage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const BookingSuccessPage = lazy(() => import('./pages/BookingSuccessPage'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const LoginPage = lazy(() => import('./pages/Login'));
const RatingsPage = lazy(() => import('./pages/RatingsPage'));
const UpdatePasswordPage = lazy(() => import('./pages/UpdatePasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const CoverageAreasPage = lazy(() => import('./pages/CoverageAreasPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const EmailConfirmedPage = lazy(() => import('./pages/EmailConfirmedPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const RateBookingPage = lazy(() => import('./pages/RateBookingPage'));
const UnsubscribePage = lazy(() => import('./pages/UnsubscribePage'));
const BuyCreditsPage = lazy(() => import('./pages/BuyCreditsPage'));
const DonationPage = lazy(() => import('./pages/DonationPage'));
const SimpleRequestPage = lazy(() => import('./pages/SimpleRequestPage'));
const Policies = lazy(() => import('./pages/Policies'));
const Terms = lazy(() => import('./pages/Terms'));
const GofileDownload = lazy(() => import('./components/GofileDownload'));

function AppContent() {
  // NavBar no longer waits for auth — it renders immediately with logged-out
  // state and updates silently once Supabase resolves the session.
  useRoutePreloader();

  return (
    <>
      <ScrollToTop />
      <NavBar />

      {/*
        PageSkeleton matches the exact structure of each page, reserving the right
        space before the real page mounts — eliminating layout shift on first load.
        It includes its own fixed NavBar skeleton so the real NavBar can coexist
        without causing a double-nav flash (the real NavBar is always mounted but
        transparent while the skeleton is showing).
      */}
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
          <Route path="/email-confirmed" element={<EmailConfirmedPage />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/coverage" element={<CoverageAreasPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/simple-request" element={<SimpleRequestPage />} />
          <Route path="/donate/:linkId" element={<DonationPage />} />
          <Route path="/rate-booking/:token" element={<RateBookingPage />} />
          <Route path="/booking/:productId" element={<BookingPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/booking-success" element={<BookingSuccessPage />} />
          <Route path="/ratings" element={<RatingsPage />} />
          <Route path="/file/gofile/:id" element={<GofileDownload />} />

          <Route path="/profile" element={
            <ProtectedRoute><ProfilePage /></ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>
          } />
          <Route path="/admin/:section" element={
            <ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>
          } />

          <Route path="/buy-credits" element={
            <ProtectedRoute><BuyCreditsPage /></ProtectedRoute>
          } />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      <Footer />
      <Toaster />
    </>
  );
}

function InitializedApp() {
  useAppInitialization();
  return (
    <ColorSystemProvider>
      <Analyse />
      <ContentManagementPanel />
      <AppContent />
    </ColorSystemProvider>
  );
}

function App() {
  return (
    <Router>
      <LoadingProvider>
        <AuthProvider>
          <DataProvider>
            <InitializedApp />
          </DataProvider>
        </AuthProvider>
      </LoadingProvider>
    </Router>
  );
}

export default App;