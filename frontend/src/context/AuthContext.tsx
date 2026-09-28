import React, { createContext, useContext, useState, ReactNode } from 'react';

// Context ekata oni wena values wala types
interface AuthContextType {
  user: any | null;
  login: () => void;
  logout: () => void;
}

// Context eka create karanna
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// App eka wata wrap karanna Provider eka
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);

  const login = () => setUser({ name: 'User' }); // Example login
  const logout = () => setUser(null); // Example logout

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Pahasuwen context eka use karanna Custom hook ekak
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
