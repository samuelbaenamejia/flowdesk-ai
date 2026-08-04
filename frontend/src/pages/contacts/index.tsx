import { useState, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useContacts } from "@/hooks/useContacts";
import { useToast } from "@/contexts/ToastContext";
import { ContactTable } from "@/components/contacts/ContactTable";
import { ContactForm } from "@/components/contacts/ContactForm";
import { TagManager } from "@/components/contacts/TagManager";
import { Pagination } from "@/components/dashboard/Pagination";
import { ErrorState } from "@/components/ui/ErrorState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Search, Plus } from "lucide-react";
import {
  createContact,
  updateContact,
  deleteContact,
  createTag,
  assignTag,
  removeTag,
} from "@/lib/api";
import type { Contact, ContactCreatePayload, ContactUpdatePayload } from "@/types";

export default function ContactsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const {
    contacts,
    total,
    loading,
    error,
    offset,
    hasMore,
    tags,
    tagsLoading,
    setSearch,
    handlePrevious,
    handleNext,
    retry,
  } = useContacts();

  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagManagerContact, setTagManagerContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = useCallback(() => {
    setEditingContact(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((contact: Contact) => {
    setEditingContact(contact);
    setFormOpen(true);
  }, []);

  const openTagManager = useCallback((contact: Contact) => {
    setTagManagerContact(contact);
    setTagManagerOpen(true);
  }, []);

  const handleSave = useCallback(async (data: ContactCreatePayload | ContactUpdatePayload) => {
    setSaving(true);
    try {
      if (editingContact) {
        await updateContact(editingContact.id, data as ContactUpdatePayload);
        addToast("success", "Contacto actualizado");
      } else {
        await createContact(data as ContactCreatePayload);
        addToast("success", "Contacto creado");
      }
      setFormOpen(false);
      setEditingContact(null);
      retry();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [editingContact, addToast, retry]);

  const handleDelete = useCallback(async (contact: Contact) => {
    setDeleting(true);
    try {
      await deleteContact(contact.id);
      addToast("success", "Contacto eliminado");
      retry();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [addToast, retry]);

  const handleCreateTag = useCallback(async (name: string) => {
    try {
      await createTag({ name });
      addToast("success", `Tag "${name}" creado`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Error al crear tag");
    }
  }, [addToast]);

  const handleAssignTag = useCallback(async (tagId: string) => {
    if (!tagManagerContact) return;
    try {
      await assignTag(tagManagerContact.id, tagId);
      addToast("success", "Tag asignado");
      retry();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Error al asignar tag");
    }
  }, [tagManagerContact, addToast, retry]);

  const handleRemoveTag = useCallback(async (tagId: string) => {
    if (!tagManagerContact) return;
    try {
      await removeTag(tagManagerContact.id, tagId);
      addToast("success", "Tag removido");
      retry();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Error al remover tag");
    }
  }, [tagManagerContact, addToast, retry]);

  const [searchValue, setSearchValue] = useState("");

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setSearchValue(v);
    setSearch(v);
  }

  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  return (
    <div className="space-y-4">
      <Head>
        <title>Contactos | FlowDesk</title>
      </Head>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Contactos</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nuevo contacto
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="text"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder="Buscar contactos..."
          aria-label="Buscar contactos"
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50"
        />
      </div>

      <ContactTable
        contacts={contacts}
        loading={loading}
        search={searchValue}
        tags={tags}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onManageTags={openTagManager}
      />

      {!loading && contacts.length > 0 && (
        <Pagination
          offset={offset}
          limit={25}
          hasMore={hasMore}
          loading={loading}
          count={contacts.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}

      <ContactForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingContact(null); }}
        onSave={handleSave}
        contact={editingContact}
        saving={saving}
      />

      {tagManagerContact && (
        <TagManager
          isOpen={tagManagerOpen}
          onClose={() => { setTagManagerOpen(false); setTagManagerContact(null); }}
          contact={tagManagerContact}
          allTags={tags}
          tagsLoading={tagsLoading}
          onAssignTag={handleAssignTag}
          onRemoveTag={handleRemoveTag}
          onCreateTag={handleCreateTag}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar contacto"
        message={`¿Eliminar a "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        variant="destructive"
        confirmText="Eliminar"
        loading={deleting}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
