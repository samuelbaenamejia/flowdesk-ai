import httpx

from app.core.config import settings

WHATSAPP_API_BASE = "https://graph.facebook.com"


class WhatsAppSendError(Exception):
    """Error al enviar mensaje a WhatsApp Cloud API."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


async def send_text_message(to: str, text: str) -> str:
    """
    Envía mensaje de texto vía WhatsApp Cloud API.

    Retorna el wa_message_id en caso de éxito.
    Lanza WhatsAppSendError en caso de error.
    """
    url = (
        f"{WHATSAPP_API_BASE}/{settings.whatsapp_graph_api_version}"
        f"/{settings.whatsapp_phone_number_id}/messages"
    )
    headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }

    timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException:
            raise WhatsAppSendError(503, "Timeout al conectar con WhatsApp API")
        except httpx.ConnectError:
            raise WhatsAppSendError(503, "Error de red al conectar con WhatsApp API")

        if response.status_code == 200:
            data = response.json()
            return data["messages"][0]["id"]

        raise WhatsAppSendError(response.status_code, response.text)
