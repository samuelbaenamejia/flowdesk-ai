import { Contact, Tag } from "@/types";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Users, X, Plus } from "lucide-react";

const HEADERS = [
  { key: "name", label: "Nombre" },
  { key: "contact_info", label: "Contacto", className: "hidden sm:table-cell" },
  { key: "tags", label: "Tags", className: "hidden md:table-cell" },
  { key: "updated", label: "", className: "hidden md:table-cell" },
  { key: "actions", label: "" },
];

interface ContactTableProps {
  contacts: Contact[];
  loading: boolean;
  search: string;
  tags: Tag[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onManageTags: (contact: Contact) => void;
}

export function ContactTable({
  contacts,
  loading,
  search,
  tags,
  onEdit,
  onDelete,
  onManageTags,
}: ContactTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="row" />
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={search ? "Sin resultados" : "No hay contactos"}
        description={
          search
            ? `No se encontraron contactos para "${search}"`
            : "Los contactos aparecerán cuando los clientes escriban o puedes crear uno manualmente."
        }
      />
    );
  }

  const rows = contacts.map((contact) => ({
    name: (
      <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
        {contact.name}
      </span>
    ),
    contact_info: (
      <div className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
        {contact.email && <div>{contact.email}</div>}
        {contact.phone && !contact.email && <div>{contact.phone}</div>}
      </div>
    ),
    tags: (
      <div className="hidden md:flex flex-wrap gap-1">
        {contact.tags.length > 0
          ? contact.tags.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: t.color + "20", color: t.color }}
              >
                {t.name}
              </span>
            ))
          : <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
      </div>
    ),
    updated: (
      <span className="hidden md:block text-sm text-gray-400 dark:text-gray-500">
        {new Date(contact.updated_at).toLocaleDateString()}
      </span>
    ),
    actions: (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onManageTags(contact)} title="Gestionar tags" aria-label={`Gestionar tags de ${contact.name}`}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onEdit(contact)} title="Editar" aria-label={`Editar ${contact.name}`}>
          <span className="text-xs">✎</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(contact)} title="Eliminar" aria-label={`Eliminar ${contact.name}`}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    ),
  }));

  return (
    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <Table headers={HEADERS} rows={rows} getRowKey={(_, i) => contacts[i].id} />
    </div>
  );
}
