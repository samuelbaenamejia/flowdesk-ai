import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";
import Layout from "@/components/Layout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import "../styles/globals.css";

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
    <AuthProvider>
      <AuthGuard>
        {isLoginPage ? (
          <Component {...pageProps} />
        ) : (
          <Layout>
            <Component {...pageProps} />
          </Layout>
        )}
      </AuthGuard>
    </AuthProvider>
  );
}
