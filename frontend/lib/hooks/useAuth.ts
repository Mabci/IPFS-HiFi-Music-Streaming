import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string | null;
  username?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        console.log('🔄 useAuth: Fetching user session...')
        const backendUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
          ? 'http://localhost:4000' 
          : 'https://ipfs-hifi-music-streaming.onrender.com'
        
        console.log('🌐 useAuth: Backend URL:', backendUrl)
        const response = await fetch(`${backendUrl}/api/auth/session`, {
          credentials: 'include'
        });

        if (response.ok) {
          const userData = await response.json();
          setAuthState({
            user: userData.user,
            loading: false,
            error: null
          });
        } else {
          setAuthState({
            user: null,
            loading: false,
            error: 'Not authenticated'
          });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setAuthState({
          user: null,
          loading: false,
          error: 'Authentication error'
        });
      }
    };

    fetchUser();
  }, []);

  const refreshUser = async () => {
    console.log('🔄 Refreshing user authentication state...');
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch('/api/me', {
        credentials: 'include'
      });

      console.log('🔍 /api/me response:', response.status, response.ok);

      if (response.ok) {
        const userData = await response.json();
        console.log('✅ User data received:', userData.user?.email);
        setAuthState({
          user: userData.user,
          loading: false,
          error: null
        });
      } else {
        console.log('❌ Authentication failed');
        setAuthState({
          user: null,
          loading: false,
          error: 'Not authenticated'
        });
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      setAuthState({
        user: null,
        loading: false,
        error: 'Authentication error'
      });
    }
  };

  return {
    ...authState,
    refreshUser
  };
}
