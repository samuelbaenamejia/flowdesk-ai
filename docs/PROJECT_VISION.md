# PROJECT VISION - FlowDesk-AI

## ¿Qué problema resuelve?

Las empresas pequeñas y medianas pierden oportunidades de negocio y ofrecen mala experiencia al cliente porque:
- No tienen personal 24/7 para atender WhatsApp
- Responden lento o inconsistente
- No tienen trazabilidad de conversaciones
- No pueden escalar atención sin contratar más gente
- Los chatbots actuales son rígidos, no entienden contexto y frustran al usuario

## ¿Quién lo usará?

**Usuarios primarios:**
- Dueños de PYMES (10-200 empleados) que usan WhatsApp Business como canal principal de ventas/soporte
- Equipos de atención al cliente que necesitan automatizar FAQs y triage

**Usuarios secundarios:**
- Agencias que gestionan WhatsApp para múltiples clientes
- Equipos de ventas que necesitan calificar leads automáticamente

## ¿Por qué existe?

Porque el 80% de las PYMES en LATAM usan WhatsApp como canal principal pero no tienen herramientas empresariales para gestionarlo. Las opciones actuales son: chatbots tontos (ManyChat, Chatfuel), CRMs caros (HubSpot, Zendesk) o desarrollos a medida inaccesibles.

FlowDesk-AI democratiza la automatización inteligente en WhatsApp usando LLMs gratuitos + n8n + arquitectura propia.

## ¿Qué valor aporta?

1. **Atención 24/7 real** con IA que entiende contexto, no solo palabras clave
2. **Triage automático**: clasifica, prioriza y deriva a humano solo cuando es necesario
3. **Memoria conversacional**: recuerda historial, preferencias y contexto del cliente
4. **Escalabilidad**: un operador humano puede supervisar 50+ conversaciones simultáneas
5. **Datos propios**: la empresa dueña de sus conversaciones, no la plataforma
6. **Extensible**: arquitectura preparada para añadir canales (Email, Webchat, Instagram, Telefonía)

## ¿Cuál será el MVP?

**Core (Semana 1-4):**
- Recibir/Enviar mensajes WhatsApp Cloud API
- Motor de clasificación de intenciones (LLM local)
- Base de conocimiento consultable (RAG simple)
- Flujo n8n: recibir → clasificar → responder/derivar
- Dashboard básico: conversaciones activas, métricas, historial
- Humano en el bucle: bandeja de entrada para tomar control

**Fuera del MVP v1:**
- Multi-agente / multi-tenant
- Analytics avanzados
- Integración CRM externa
- Voice messages (STT/TTS)
- Marketplace de plantillas

## ¿Cómo podría crecer?

| Fase | Evolución |
|------|-----------|
| v1.0 | Single-tenant, WhatsApp only, self-hosted |
| v1.5 | Multi-tenant SaaS, dashboard white-label |
| v2.0 | Multi-canal (Email, Webchat, Instagram DM) |
| v2.5 | Voice AI (Twilio + Whisper + TTS) |
| v3.0 | Marketplace de agentes especializados por vertical |
| v4.0 | Plataforma de orquestación de agentes autónomos |

## ¿Qué NO hará?

- ❌ NO será un CRM completo (no gestiona pipeline de ventas, deals, forecasting)
- ❌ NO reemplazará helpdesk enterprise (no tiene SLA management, ticketing complejo)
- ❌ NO hará outbound marketing masivo (anti-spam, políticas Meta)
- ❌ NO usará modelos propietarios obligatorios (siempre opción local/gratuita)
- ❌ NO será no-code para usuarios finales (es low-code para devs/agencias)
- ❌ NO almacenará datos en la nube de terceros sin consentimiento (data sovereignty)