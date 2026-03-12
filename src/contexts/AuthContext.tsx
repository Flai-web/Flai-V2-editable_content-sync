import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: SupabaseUser | null;
  isAdmin: boolean;
  credits: number;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, redirectPath?: string, fullName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: (returnPath?: string) => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  // profileLoading stays true until the DB profile fetch completes after user loads
  const [profileLoading, setProfileLoading] = useState(false);

  const checkUserProfile = async (userId: string) => {
    try {
      const { data: userData, error } = await supabase
        .from('profiles')
        .select('is_admin, credits')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking user profile:', error);
        return { isAdmin: false, credits: 0 };
      }

      return {
        isAdmin: userData?.is_admin || false,
        credits: userData?.credits || 0
      };
    } catch (err) {
      console.error('Error in checkUserProfile:', err);
      return { isAdmin: false, credits: 0 };
    }
  };

  const refreshCredits = async () => {
    if (!user) return;
    
    try {
      const { data: userData, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error refreshing credits:', error);
        return;
      }

      setCredits(userData?.credits || 0);
    } catch (err) {
      console.error('Error in refreshCredits:', err);
    }
  };

  useEffect(() => {
    // ── Official Supabase React pattern ──────────────────────────────────────
    // getSession() for initial load; onAuthStateChange for everything after.
    // CRITICAL: Never await Supabase DB calls inside onAuthStateChange —
    // the library holds an internal lock during the callback and any awaited
    // supabase query will deadlock. Profile fetch lives in a separate useEffect.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN') {
        // After a Google OAuth redirect, recover the intended destination
        const savedPath = sessionStorage.getItem('postAuthRedirect');
        if (savedPath) {
          sessionStorage.removeItem('postAuthRedirect');
          // Use replace so the auth callback URL isn't left in browser history
          window.location.replace(savedPath);
        }
      }
      if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
        setCredits(0);
        toast.success('Du er nu logget ud');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile whenever user identity changes — runs outside the auth lock
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setCredits(0);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    checkUserProfile(user.id).then((profile) => {
      setIsAdmin(profile.isAdmin);
      setCredits(profile.credits);
      setProfileLoading(false);
    });
  }, [user?.id]);

  // Set up real-time subscription for credits updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile_credits_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`
      }, (payload) => {
        if (payload.new && 'credits' in payload.new) {
          setCredits(payload.new.credits);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const signUp = async (email: string, password: string, redirectPath?: string, fullName?: string) => {
    try {
      const postAuthPath = redirectPath && redirectPath !== '/' ? redirectPath : '/profile';
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${postAuthPath}`,
          data: fullName ? { full_name: fullName, name: fullName } : undefined,
        }
      });
      
      if (error) throw error;

      toast.success('Konto oprettet! Du kan nu logge ind.');
      return { error: null };
    } catch (error: any) {
      console.error('Error in signUp:', error);
      toast.error('Kunne ikke oprette konto');
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };

      if (!data.session) {
        return { error: new Error('Ingen session returneret fra login') };
      }

      return { error: null };
    } catch (error: any) {
      console.error('Error in signIn:', error);
      return { error };
    }
  };

  const signOut = async (returnPath?: string) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setIsAdmin(false);
      setCredits(0);

      // Return to the page the user was on, or fall back to home
      window.location.href = returnPath || '/';
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Kunne ikke logge ud');
    }
  };

  const value = {
    user,
    isAdmin,
    credits,
    loading,
    profileLoading,
    signUp,
    signIn,
    signOut,
    refreshCredits,
  };

  // No loading spinner — render immediately and let auth resolve in background.
  // Page content doesn't need auth; only admin features gate on isAdmin.
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};