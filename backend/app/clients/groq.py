import httpx

from app.core.config import settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


async def generate_response(messages: list[dict]) -> str:
    """
    Genera respuesta vía Groq API.

    Args:
        messages: Lista de mensajes formateados para Groq API
                  [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]

    Returns:
        Texto de la respuesta generada.

    Raises:
        GroqError: Con status_code y detail en caso de error.
    """
    payload = {
        "model": settings.groq_model,
        "messages": messages,
        "max_tokens": settings.groq_max_tokens,
        "temperature": settings.groq_temperature,
    }

    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
    timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(GROQ_API_URL, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise GroqError(503, "Timeout al conectar con Groq API") from exc
        except httpx.ConnectError as exc:
            raise GroqError(503, "Error de red al conectar con Groq API") from exc

        if response.status_code == 200:
            data = response.json()
            try:
                return data["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError) as exc:
                raise GroqError(502, "Respuesta Groq inválida") from exc

        raise GroqError(response.status_code, response.text)