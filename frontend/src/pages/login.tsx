import { FormEvent, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      router.replace("/conversations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Head>
        <title>Iniciar sesión | FlowDesk</title>
      </Head>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none"
      >
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-gray-50">
          FlowDesk-AI
        </h1>

        {error && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="mb-4">
          <Input
            label="Email"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="mb-6">
          <Input
            label="Contraseña"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" loading={submitting} className="w-full">
          Iniciar sesión
        </Button>
      </form>
    </div>
  );
}
