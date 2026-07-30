import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Contact, ContactCreatePayload, ContactUpdatePayload } from "@/types";

interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ContactCreatePayload | ContactUpdatePayload) => Promise<void>;
  contact: Contact | null;
  saving: boolean;
}

export function ContactForm({ isOpen, onClose, onSave, contact, saving }: ContactFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(contact?.name ?? "");
      setPhone(contact?.phone ?? "");
      setEmail(contact?.email ?? "");
      setNotes(contact?.notes ?? "");
    }
  }, [isOpen, contact]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = contact
      ? { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, notes: notes.trim() || undefined }
      : { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, notes: notes.trim() || undefined };
    await onSave(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-form-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 id="contact-form-title" className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {contact ? "Editar contacto" : "Nuevo contacto"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Input
            label="Nombre *"
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Teléfono"
            id="contact-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
          />
          <Input
            label="Email"
            id="contact-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
          <div>
            <label htmlFor="contact-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} disabled={!name.trim()}>
              {contact ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
