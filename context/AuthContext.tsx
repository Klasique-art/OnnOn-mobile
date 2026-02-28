import React, {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import { authStorage } from "@/lib/auth";

type AuthContextType = {
  token: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setTokenState] = useState<string | null>(null);

  const setToken = async (nextToken: string | null) => {
    if (nextToken) {
      await authStorage.setToken(nextToken);
    } else {
      await authStorage.clearToken();
    }
    setTokenState(nextToken);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      setToken,
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
