import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { UserProfile, UpdateProfileRequest } from "@/types";

interface ProfileFormProps {
  profile: UserProfile;
  saving: boolean;
  saveError: string | null;
  onSave: (data: UpdateProfileRequest) => Promise<void>;
}

export function ProfileForm({ profile, saving, saveError, onSave }: ProfileFormProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(profile.name ?? "");
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ name: name.trim() || null });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Información personal</h2>

      {saveError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400" role="alert">
          {saveError}
        </div>
      )}

      <Input
        label="Email"
        id="profile-email"
        value={profile.email}
        disabled
        helperText="El email no se puede cambiar"
      />

      <Input
        label="Nombre"
        id="profile-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tu nombre"
      />

      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={saving}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
