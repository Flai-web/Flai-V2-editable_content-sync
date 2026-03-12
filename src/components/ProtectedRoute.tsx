import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false, requireAdmin = false }) => {
  const { user, loading, profileLoading, isAdmin } = useAuth();
  const location = useLocation();

  // Wait for session AND profile to both be resolved before making any decision
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} />;
  }

  if ((adminOnly || requireAdmin) && !isAdmin) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;