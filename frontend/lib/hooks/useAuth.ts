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
        const response = await fetch('/api/me', {
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
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch('/api/me', {
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
