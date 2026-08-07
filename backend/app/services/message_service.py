import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, InvalidRequestError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.groq import GroqError, generate_response
from app.clients.whatsapp import WhatsAppSendError, send_text_message
from app.core.config import settings
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message, MessageStatus

logger = logging.getLogger(__name__)

FALLBACK_RESPONSE = "Lo siento, estoy teniendo problemas técnicos. Un agente te atenderá en breve."


async def get_conversation_history(
    conversation_id: uuid.UUID,
    db: AsyncSession,
) -> list[dict]:
    """Obtiene últimos N mensajes formateados para Groq."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(settings.groq_history_limit)
    )
    messages = list(reversed(result.scalars().all()))

    history = []
    for msg in messages:
        role = "user" if msg.direction == "incoming" else "assistant"
        history.append({"role": role, "content": msg.content})
    return history


async def send_outgoing_message(
    conversation_id: uuid.UUID,
    content: str,
    db: AsyncSession,
) -> Message:
    """
    Reutiliza lógica de envío de PR #9.
    Persiste mensaje outgoing, envía a WhatsApp, actualiza status/wa_message_id.
    Retorna el Message creado.
    """
    # 1. Obtener conversación y contacto
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    result = await db.execute(
        select(Contact).where(Contact.id == conversation.contact_id)
    )
    contact = result.scalar_one_or_none()
    if contact is None:
        raise ValueError(f"Contact for conversation {conversation_id} not found")

    # 2. Fase 1: Persistir como pending
    message = Message(
        conversation_id=conversation_id,
        direction="outgoing",
        content_type="text",
        content=content,
        status="pending",
    )
    db.add(message)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.warning(
            "whatsapp.send: mensaje duplicado conversation_id=%s",
            conversation_id,
        )
        raise ValueError("Message creation failed due to integrity constraint") from exc

    try:
        await db.refresh(message)
    except InvalidRequestError:
        pass
    logger.info(
        "whatsapp.send: mensaje persistido conversation_id=%s message_id=%s",
        conversation_id,
        message.id,
    )

    # 3. Fase 2: Enviar a WhatsApp
    try:
        wa_message_id = await send_text_message(contact.wa_id, content)
    except WhatsAppSendError as exc:
        # El mensaje ya fue persistido como "pending" en el commit de Fase 1.
        # Marquelo como "failed" para que no quede huérfano e informe al agente.
        logger.exception(
            "whatsapp.send: error Meta conversation_id=%s message_id=%s "
            "meta_status=%s detail=%s",
            conversation_id,
            message.id,
            exc.status_code,
            exc.detail,
        )
        try:
            message.status = MessageStatus.FAILED
            await db.commit()
            logger.info(
                "whatsapp.send: mensaje marcado failed message_id=%s",
                message.id,
            )
        except Exception:
            logger.exception(
                "whatsapp.send: no se pudo marcar failed message_id=%s",
                message.id,
            )
            await db.rollback()
        # Conservamos el traceback: el caller decide si relanzar o silenciar.
        raise

    logger.info(
        "whatsapp.send: enviado a Meta conversation_id=%s wa_message_id=%s",
        conversation_id,
        wa_message_id,
    )

    # 4. Fase 3: Actualizar estado
    message.status = "sent"
    message.wa_message_id = wa_message_id
    conversation.last_message_at = message.created_at

    try:
        await db.commit()
    except Exception:
        logger.exception(
            "whatsapp.send: commit fase 3 falló conversation_id=%s "
            "wa_message_id=%s",
            conversation_id,
            wa_message_id,
        )
        raise

    try:
        await db.refresh(message)
    except InvalidRequestError:
        pass
    logger.info(
        "whatsapp.send: completado conversation_id=%s wa_message_id=%s",
        conversation_id,
        wa_message_id,
    )

    return message


async def process_incoming_and_respond(
    conversation_id: uuid.UUID,
    user_message: str,
    db: AsyncSession,
) -> None:
    """
    Flujo completo: genera respuesta con Groq y envía vía WhatsApp.
    Invocado desde webhook tras persistir mensaje entrante.
    """
    # 0. Verificar si la conversación está en takeover humano
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        logger.warning(
            "llm.respond: conversación no encontrada conversation_id=%s",
            conversation_id,
        )
        return

    if conversation.status != "active":
        logger.info(
            "llm.respond: conversación en takeover, sin respuesta automática "
            "conversation_id=%s status=%s",
            conversation_id,
            conversation.status,
        )
        return

    # 1. Obtener historial
    history = await get_conversation_history(conversation_id, db)

    # 2. Construir mensajes para Groq
    messages = [
        {"role": "system", "content": settings.groq_system_prompt.replace("{EMPRESA}", settings.company_name)},
        *history,
        {"role": "user", "content": user_message},
    ]

    # 4. Enviar respuesta (usa fallback si Groq falla)
    try:
        response_text = await generate_response(messages)
    except GroqError as exc:
        logger.error(
            "llm.generate falló conversation_id=%s status=%s detail=%s",
            conversation_id,
            exc.status_code,
            exc.detail,
        )
        response_text = FALLBACK_RESPONSE

    # 4. Enviar respuesta (reutiliza lógica PR #9)
    try:
        await send_outgoing_message(conversation_id, response_text, db)
    except Exception:
        logger.exception(
            "send_outgoing falló conversation_id=%s",
            conversation_id,
        )
        # No relanzar: webhook debe responder 200