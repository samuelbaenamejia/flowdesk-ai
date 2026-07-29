import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";

const MAX_VISIBLE_LINES = 6;
const LINE_HEIGHT = 24;

interface ComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled: boolean;
  sending: boolean;
  error: string | null;
}

export function Composer({ onSend, disabled, sending, error }: ComposerProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const maxHeight = MAX_VISIBLE_LINES * LINE_HEIGHT;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleSend = useCallback(async () => {
    if (!contentRef.current.trim() || sending || disabled) return;
    try {
      await onSend(contentRef.current.trim());
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    } catch {
      // Keep content on error
    }
  }, [sending, disabled, onSend]);

  return (
    <div className="border-t border-gray-200 p-4 dark:border-gray-700">
      {error && (
        <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2 max-md:gap-1">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          disabled={disabled || sending}
          rows={1}
          autoFocus
          aria-label="Escribe un mensaje"
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50 dark:placeholder-gray-400"
        />
        <Button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          loading={sending}
          aria-label="Enviar mensaje"
          className="shrink-0"
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}
