import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

interface GoogleLoginButtonProps {
  buttonText?: string;
  redirectTo?: string;
  bookingState?: {
    productId?: string;
    selectedTimeSlot?: any;
    address?: string;
    includeEditing?: boolean;
    totalPrice?: number;
    customerAddress?: string;
    wantsEditing?: boolean;
    paymentMethod?: string;
  };
  compact?: boolean;
  className?: string;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ 
  buttonText = 'Log ind med Google',
  redirectTo,
  bookingState,
  compact = false,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // Save booking state to sessionStorage before OAuth redirect
      if (bookingState) {
        // For smart booking, save as smartBookingState
        if (bookingState.customerAddress || bookingState.paymentMethod) {
          sessionStorage.setItem('smartBookingState', JSON.stringify(bookingState));
        } else {
          // For regular booking
          sessionStorage.setItem('bookingState', JSON.stringify(bookingState));
        }
      }

      // Persist the intended post-auth destination across the OAuth redirect.
      // redirectTo may be a full URL (e.g. origin + path) or just origin.
      // We extract the pathname so we can navigate back after Google returns.
      let postAuthPath = '/';
      if (redirectTo) {
        try {
          const url = new URL(redirectTo);
          postAuthPath = url.pathname + url.search;
        } catch {
          // redirectTo was already a plain path
          postAuthPath = redirectTo;
        }
      }
      if (postAuthPath && postAuthPath !== '/') {
        sessionStorage.setItem('postAuthRedirect', postAuthPath);
      }

      // Always send Google back to origin root — the AuthContext effect will
      // pick up sessionStorage and navigate to the real destination.
      const oauthRedirectUrl = window.location.origin;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: oauthRedirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error logging in with Google:', error);
      toast.error('Kunne ikke logge ind med Google. Prøv venligst igen.');
      setLoading(false);
    }
  };
  
// Compact mode for inline usage in form fields
if (compact) {
  return (
    <button
      onClick={handleGoogleLogin}
      disabled={loading}
      type="button"
      className={`flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-neutral-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Udfyld med Google"
    >
      <span className="text-sm text-gray-600 whitespace-nowrap">Udfyld med</span>
      {loading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
    </button>
  );
}

  // Full button mode (default)
  return (
    <button
      onClick={handleGoogleLogin}
      disabled={loading}
      type="button"
      className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.8055 10.2292C19.8055 9.55156 19.7501 8.86719 19.6323 8.19531H10.2002V12.0492H15.6014C15.3734 13.2911 14.6571 14.3898 13.6179 15.0875V17.5867H16.8294C18.7172 15.8449 19.8055 13.2729 19.8055 10.2292Z" fill="#4285F4"/>
            <path d="M10.2002 20.0008C12.9515 20.0008 15.2664 19.1152 16.8294 17.5867L13.6179 15.0875C12.7368 15.6977 11.6007 16.0437 10.2002 16.0437C7.54788 16.0437 5.30085 14.2828 4.52314 11.9102H1.22559V14.4821C2.81488 17.6437 6.33844 20.0008 10.2002 20.0008Z" fill="#34A853"/>
            <path d="M4.52314 11.9102C4.05271 10.6683 4.05271 9.33309 4.52314 8.09121V5.51934H1.22559C-0.408529 8.77684 -0.408529 12.2246 1.22559 15.4821L4.52314 11.9102Z" fill="#FBBC04"/>
            <path d="M10.2002 3.95766C11.6761 3.93594 13.1005 4.47203 14.1824 5.45547L17.0317 2.60547C15.1765 0.904844 12.7314 -0.0234375 10.2002 0.000390625C6.33844 0.000390625 2.81488 2.35734 1.22559 5.51934L4.52314 8.09121C5.30085 5.71859 7.54788 3.95766 10.2002 3.95766Z" fill="#EA4335"/>
          </svg>
          {buttonText}
        </>
      )}
    </button>
  );
};

export default GoogleLoginButton;