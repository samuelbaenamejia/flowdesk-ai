# Changelog

## v0.4.0 (2026-07-28)

### Features
- **F2 — Dashboard**: Refactor completo con useConversations hook, filtros, paginación, ConversationTable
- **F3 — Conversation Workspace**: ConversationHeader, MessageBubble, MessageList, Composer, useConversation, useMessages
- **F4A — Responsive Design**: AppShell con sidebar state + backdrop overlay mobile, tablas overflow-x-auto, columnas responsive, dvh en lugar de vh
- **F4B — Dark Mode**: Tailwind `darkMode: "class"`, ThemeContext + useTheme, `_document.tsx` anti-flicker, 22 archivos con clases `dark:`
- **F4C — Realtime (Smart Polling)**: Polling 5s/10s/15s con `after` timestamp, Set-based dedup, visibility pause/resume, 0 nuevas dependencias
- **Testing**: 153 tests, 21 test files, coverage thresholds al 90%

### Technical
- Backend: `after` query param en GET messages para filtro incremental
- Frontend: 7 UI components (Button, Input, Badge, Table, Skeleton, EmptyState, ErrorState)
- Frontend: 3 hooks polling-aware (useMessages, useConversations, useConversation)
