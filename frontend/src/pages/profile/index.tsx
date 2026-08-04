import { useCallback, useState } from "react";
import Head from "next/head";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/contexts/ToastContext";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { PreferencesSection } from "@/components/profile/PreferencesSection";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UpdateProfileRequest, ChangePasswordRequest } from "@/types";

export default function ProfilePage() {
  const { profile, loading, error, saving, saveProfile, savePassword, retry } = useProfile();
  const { addToast } = useToast();
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveProfile = useCallback(async (data: UpdateProfileRequest) => {
    try {
      await saveProfile(data);
      addToast("success", "Perfil actualizado");
    } catch {
      addToast("error", "Error al actualizar perfil");
    }
  }, [saveProfile, addToast]);

  const handleSavePassword = useCallback(async (data: ChangePasswordRequest) => {
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await savePassword(data);
      addToast("success", "Contraseña cambiada correctamente");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cambiar contraseña";
      setPasswordError(msg);
      throw err;
    } finally {
      setPasswordSaving(false);
    }
  }, [savePassword, addToast]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={retry ?? (() => window.location.reload())} />;
  }

  if (!profile) {
    return <ErrorState message="No se pudo cargar el perfil" onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Head>
        <title>Perfil | FlowDesk</title>
      </Head>
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <ProfileForm
          profile={profile}
          saving={saving}
          saveError={null}
          onSave={handleSaveProfile}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <ChangePasswordForm
          saving={passwordSaving}
          saveError={passwordError}
          onSave={handleSavePassword}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <PreferencesSection />
      </div>
    </div>
  );
}
