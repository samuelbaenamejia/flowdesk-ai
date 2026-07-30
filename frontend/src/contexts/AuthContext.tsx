import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { User } from "@/types";
import { apiClient } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return apiClient.subscribe((token) => {
      if (!token) {
        setUser(null);
      }
    });
  }, []);

  useEffect(() => {
    const storedRefresh = localStorage.getItem("refresh_token");
    if (!storedRefresh) {
      setLoading(false);
      return;
    }

    const existingToken = apiClient.getAccessToken();
    if (existingToken) {
      apiClient
        .getMe()
        .then((userData) => setUser(userData))
        .catch(() => attemptSessionRestore())
        .finally(() => setLoading(false));
    } else {
      attemptSessionRestore().finally(() => setLoading(false));
    }
  }, []);

  async function attemptSessionRestore() {
    try {
      const success = await apiClient.refreshAuth();
      if (success) {
        const userData = await apiClient.getMe();
        setUser(userData);
      } else {
        localStorage.removeItem("refresh_token");
      }
    } catch {
      localStorage.removeItem("refresh_token");
    }
  }

  const login = async (email: string, password: string) => {
    await apiClient.login(email, password);
    const userData = await apiClient.getMe();
    setUser(userData);
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
