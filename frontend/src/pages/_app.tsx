import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";
import { Inter } from "next/font/google";
import AppShell from "@/components/layout/AppShell";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = router.pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!isLoginPage && !user) {
      router.replace("/login");
    }
    if (isLoginPage && user) {
      router.replace("/conversations");
    }
  }, [loading, user, isLoginPage, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Cargando...</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isLoginPage = router.pathname === "/login";

  return (
    <ThemeProvider>
      <div className={`${inter.variable} font-sans`}>
        <AuthProvider>
          <AuthGuard>
            {isLoginPage ? (
              <Component {...pageProps} />
            ) : (
              <AppShell
                title={
                  router.pathname === "/conversations"
                    ? "Conversaciones"
                    : router.pathname === "/conversations/[id]"
                      ? "Conversación"
                      : "Dashboard"
                }
              >
                <Component {...pageProps} />
              </AppShell>
            )}
          </AuthGuard>
        </AuthProvider>
      </div>
    </ThemeProvider>
  );
}
