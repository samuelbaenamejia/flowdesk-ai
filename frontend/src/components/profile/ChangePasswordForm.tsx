import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ChangePasswordRequest } from "@/types";

interface ChangePasswordFormProps {
  saving: boolean;
  saveError: string | null;
  onSave: (data: ChangePasswordRequest) => Promise<void>;
}

export function ChangePasswordForm({ saving, saveError, onSave }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (newPassword.length < 8) {
      setValidationError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Las contraseñas no coinciden");
      return;
    }

    try {
      await onSave({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      // error handled by parent
    }
  }

  const displayError = validationError || saveError;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Cambiar contraseña</h2>

      {displayError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400" role="alert">
          {displayError}
        </div>
      )}

      <Input
        label="Contraseña actual"
        id="current-password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
      />

      <Input
        label="Nueva contraseña"
        id="new-password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        helperText="Mínimo 8 caracteres"
      />

      <Input
        label="Confirmar nueva contraseña"
        id="confirm-password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />

      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}
