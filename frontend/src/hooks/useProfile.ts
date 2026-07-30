import { useEffect, useState, useCallback } from "react";
import { getProfile, updateProfile, changePassword } from "@/lib/api";
import type {
  UserProfile,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from "@/types";

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  fetchProfile: () => void;
  retry: () => void;
  saveProfile: (data: UpdateProfileRequest) => Promise<void>;
  savePassword: (data: ChangePasswordRequest) => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar perfil");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const saveProfile = useCallback(async (data: UpdateProfileRequest) => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateProfile(data);
      setProfile(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar perfil";
      setSaveError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const savePassword = useCallback(async (data: ChangePasswordRequest) => {
    setSaving(true);
    setSaveError(null);
    try {
      await changePassword(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cambiar contraseña";
      setSaveError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    profile,
    loading,
    error,
    saving,
    saveError,
    fetchProfile,
    retry: fetchProfile,
    saveProfile,
    savePassword,
  };
}
