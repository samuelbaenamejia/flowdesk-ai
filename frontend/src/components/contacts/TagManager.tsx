import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, Plus } from "lucide-react";
import type { Contact, Tag } from "@/types";

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact;
  allTags: Tag[];
  tagsLoading: boolean;
  onAssignTag: (tagId: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<void>;
}

export function TagManager({
  isOpen,
  onClose,
  contact,
  allTags,
  tagsLoading,
  onAssignTag,
  onRemoveTag,
  onCreateTag,
}: TagManagerProps) {
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const contactTagIds = new Set(contact.tags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !contactTagIds.has(t.id));

  if (!isOpen) return null;

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreateTag(name);
      setNewTagName("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-manager-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 id="tag-manager-title" className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Tags — {contact.name}
        </h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags asignados</p>
          {contact.tags.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin tags asignados</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: t.color + "20", color: t.color }}
                >
                  {t.name}
                  <button onClick={() => onRemoveTag(t.id)} className="hover:opacity-70" aria-label={`Quitar tag ${t.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Agregar tag existente</p>
          {tagsLoading ? (
            <p className="text-sm text-gray-400">Cargando tags...</p>
          ) : availableTags.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No hay más tags disponibles</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onAssignTag(t.id)}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium hover:opacity-70"
                  style={{ borderColor: t.color + "40", color: t.color }}
                >
                  <Plus className="h-3 w-3" />
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Crear nuevo tag</p>
          <div className="flex gap-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Nombre del tag"
              aria-label="Nombre del nuevo tag"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }}
            />
            <Button size="sm" onClick={handleCreateTag} loading={creating} disabled={!newTagName.trim()}>
              Crear
            </Button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
