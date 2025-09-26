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
          // BYPASS MODE: Usar usuario fake para testing
          console.log('🚧 FRONTEND BYPASS MODE: Using fake user for testing');
          setAuthState({
            user: {
              id: 'cmg0jadzt0000bt2b36x5uqm7',
              email: 'test@nyauwu.com',
              username: 'testuser'
            },
            loading: false,
            error: null
          });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        // BYPASS MODE: Usar usuario fake en caso de error también
        console.log('🚧 FRONTEND BYPASS MODE: Using fake user due to error');
        setAuthState({
          user: {
            id: 'cmg0jadzt0000bt2b36x5uqm7',
            email: 'test@nyauwu.com',
            username: 'testuser'
          },
          loading: false,
          error: null
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
        // BYPASS MODE: Usar usuario fake para testing
        setAuthState({
          user: {
            id: 'cmg0jadzt0000bt2b36x5uqm7',
            email: 'test@nyauwu.com',
            username: 'testuser'
          },
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      // BYPASS MODE: Usar usuario fake en caso de error
      setAuthState({
        user: {
          id: 'cmg0jadzt0000bt2b36x5uqm7',
          email: 'test@nyauwu.com',
          username: 'testuser'
        },
        loading: false,
        error: null
      });
    }
  };

  return {
    ...authState,
    refreshUser
  };
}
