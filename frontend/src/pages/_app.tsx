import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";
import { Inter } from "next/font/google";
import AppShell from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ToastContainer } from "@/components/ui/Toast";
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
      router.replace("/dashboard");
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
      <ToastProvider>
      <div className={`${inter.variable} font-sans`}>
        <ToastContainer />
        <ErrorBoundary>
        <AuthProvider>
          <AuthGuard>
            {isLoginPage ? (
              <Component {...pageProps} />
            ) : (
              <AppShell
                title={
                  router.pathname === "/dashboard"
                    ? "Dashboard"
                    : router.pathname === "/conversations"
                      ? "Conversaciones"
                      : router.pathname === "/conversations/[id]"
                        ? "Conversación"
                        : router.pathname === "/contacts"
                          ? "Contactos"
                          : router.pathname === "/profile"
                            ? "Perfil"
                            : "Dashboard"
                }
              >
                <Component {...pageProps} />
              </AppShell>
            )}
          </AuthGuard>
        </AuthProvider>
        </ErrorBoundary>
      </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
