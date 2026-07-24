import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.whatsapp import WhatsAppSendError, send_text_message
from app.core.config import settings
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message

logger = logging.getLogger(__name__)


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

    await db.refresh(message)
    logger.info(
        "whatsapp.send: mensaje persistido conversation_id=%s message_id=%s",
        conversation_id,
        message.id,
    )

    # 3. Fase 2: Enviar a WhatsApp
    try:
        wa_message_id = await send_text_message(contact.wa_id, content)
    except WhatsAppSendError as exc:
        logger.error(
            "whatsapp.send: error Meta conversation_id=%s message_id=%s "
            "meta_status=%s detail=%s",
            conversation_id,
            message.id,
            exc.status_code,
            exc.detail,
        )
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

    await db.refresh(message)
    logger.info(
        "whatsapp.send: completado conversation_id=%s wa_message_id=%s",
        conversation_id,
        wa_message_id,
    )

    return message