import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

const ACCESS_KEY = "1988"; // Master password

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({ id: 1, name: "Operatore", email: "operatore@apollo.local" });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Start true to check localStorage
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({});

  useEffect(() => {
    // Check localStorage on boot
    const storedAuth = localStorage.getItem("app_authenticated");
    if (storedAuth === "true") {
      setIsAuthenticated(true);
    } else {
      setAuthError({ type: 'auth_required' });
    }
    setIsLoadingAuth(false);
  }, []);

  const login = (key) => {
    if (key === ACCESS_KEY) {
      localStorage.setItem("app_authenticated", "true");
      setIsAuthenticated(true);
      setAuthError(null);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("app_authenticated");
    setIsAuthenticated(false);
    setAuthError({ type: 'auth_required' });
  };

  const checkAppState = async () => {};

  const navigateToLogin = () => {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      login,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
