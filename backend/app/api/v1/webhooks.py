import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.webhook import WebhookChange, WebhookPayload

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/webhooks/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
) -> PlainTextResponse:
    if hub_mode != "subscribe":
        logger.warning("webhook.verify: hub.mode=%s", hub_mode)
        return PlainTextResponse(status_code=403, content="forbidden")

    if hub_verify_token != settings.whatsapp_verify_token:
        logger.warning("webhook.verify: token no coincide")
        return PlainTextResponse(status_code=403, content="forbidden")

    logger.info("webhook.verify: verificación exitosa")
    return PlainTextResponse(content=hub_challenge)


async def _valid_signature(request: Request) -> bool:
    """Valida la firma X-Hub-Signature-256 de Meta sobre el body crudo.

    La firma es HMAC-SHA256 del body tal cual llega (bytes exactos, no JSON
    re-serializado), usando el App Secret de la aplicación de Meta.
    """
    if not settings.whatsapp_app_secret:
        logger.warning("webhook.signature: app_secret no configurado")
        return False

    signature = request.headers.get("X-Hub-Signature-256", "")
    if not signature:
        logger.warning("webhook.signature: cabecera ausente")
        return False

    payload = await request.body()

    expected = hmac.new(
        settings.whatsapp_app_secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature, f"sha256={expected}")


@router.post("/webhooks/whatsapp")
async def receive_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Meta firma el body crudo con HMAC-SHA256 usando el App Secret.
    # Rechazamos cualquier payload sin firma o con firma inválida.
    if not await _valid_signature(request):
        logger.warning("webhook.receive: firma X-Hub-Signature-256 inválida")
        raise HTTPException(
            status_code=403,
            detail="Invalid signature",
        )

    try:
        body = await request.json()
    except json.JSONDecodeError:
        logger.warning("webhook.receive: JSON inválido")
        return {"status": "ok"}

    try:
        payload = WebhookPayload(**body)
    except ValidationError:
        logger.warning("webhook.receive: payload inválido")
        return {"status": "ok"}

    if payload.object != "whatsapp_business_account":
        logger.info("webhook.receive: objeto no WhatsApp object=%s", payload.object)
        return {"status": "ok"}

    for entry in payload.entry:
        for change in entry.changes:
            try:
                await _process_webhook_entry(change, db)
                await db.commit()
            except IntegrityError:
                await db.rollback()
                logger.warning("webhook.receive: wa_message_id duplicado")
            except Exception:
                await db.rollback()
                logger.exception("webhook.receive: error procesando")

    return {"status": "ok"}


async def _process_webhook_entry(change: WebhookChange, db: AsyncSession) -> None:
    value = change.value

    if value.metadata is None:
        logger.warning("webhook.process: metadata vacío")
        return

    if value.metadata.phone_number_id != settings.whatsapp_phone_number_id:
        logger.info(
            "webhook.process: phone_number_id no coincide recibido=%s configurado=%s",
            value.metadata.phone_number_id,
            settings.whatsapp_phone_number_id,
        )
        return

    if value.messages:
        for message in value.messages:
            await _process_message(message, value.contacts, db)

    if value.statuses:
        for status in value.statuses:
            await _process_status(status, db)


async def _notify_n8n(
    conversation_id: uuid.UUID, contact_wa_id: str, message_text: str
) -> None:
    payload = {
        "event": "message_received",
        "conversation_id": str(conversation_id),
        "contact_wa_id": contact_wa_id,
        "message_preview": message_text,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            await client.post(settings.n8n_webhook_url, json=payload)
        logger.info(
            "webhook.n8n: notificado conversation_id=%s", conversation_id
        )
    except Exception:
        logger.exception(
            "webhook.n8n: error notificando conversation_id=%s",
            conversation_id,
        )


async def _process_message(message, contacts, db: AsyncSession) -> None:
    if message.type != "text":
        logger.info("webhook.message: tipo no soportado type=%s ignorado", message.type)
        return

    contact_wa_id = message.from_
    contact_name = "Unknown"
    if contacts:
        for c in contacts:
            if c.wa_id == contact_wa_id:
                contact_name = c.profile.name
                break

    result = await db.execute(
        select(Contact).where(Contact.wa_id == contact_wa_id)
    )
    contact = result.scalar_one_or_none()

    if contact is None:
        contact = Contact(wa_id=contact_wa_id, name=contact_name)
        db.add(contact)
        await db.flush()
        logger.info("webhook.message: contacto creado wa_id=%s", contact_wa_id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.contact_id == contact.id,
            Conversation.status.in_(["active", "human_takeover"]),
        ).order_by(Conversation.last_message_at.desc().nulls_last()).limit(1)
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        conversation = Conversation(contact_id=contact.id, status="active")
        db.add(conversation)
        await db.flush()
        logger.info("webhook.message: conversación creada contact_id=%s", contact.id)

    msg = Message(
        conversation_id=conversation.id,
        direction="incoming",
        content_type="text",
        content=message.text.body,
        wa_message_id=message.id,
        status="sent",
    )
    db.add(msg)

    conversation.last_message_at = datetime.now(UTC)
    conversation.unread_count = conversation.unread_count + 1

    logger.info(
        "webhook.message: mensaje persistido conversation_id=%s wa_message_id=%s",
        conversation.id,
        message.id,
    )

    # Notificar a n8n si está habilitado
    if settings.n8n_enabled and settings.n8n_webhook_url:
        asyncio.create_task(
            _notify_n8n(conversation.id, contact.wa_id, message.text.body)
        )

    # Modo primary: saltar respuesta automática (n8n la orquesta)
    if settings.n8n_enabled and settings.n8n_mode == "primary":
        logger.info(
            "webhook.message: modo primary, delegando a n8n "
            "conversation_id=%s",
            conversation.id,
        )
        return

    # Respuesta automática (disabled o mirror)
    try:
        from app.services.message_service import process_incoming_and_respond

        await process_incoming_and_respond(
            conversation.id, message.text.body, db
        )
    except Exception:
        logger.exception(
            "webhook.message: error generando respuesta conversation_id=%s",
            conversation.id,
        )


async def _process_status(status, db: AsyncSession) -> None:
    result = await db.execute(
        select(Message).where(Message.wa_message_id == status.id)
    )
    message = result.scalar_one_or_none()

    if message is None:
        logger.info(
            "webhook.status: mensaje no encontrado wa_message_id=%s ignorado", status.id
        )
        return

    message.status = status.status
    logger.info(
        "webhook.status: estado actualizado wa_message_id=%s nuevo estado=%s",
        status.id,
        status.status,
    )
