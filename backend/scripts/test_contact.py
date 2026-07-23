import asyncio

from app.core.database import async_session
from app.models.contact import Contact


async def test() -> None:
    async with async_session() as session:
        contact = Contact(
            wa_id="573001234567",
            name="Juan Pérez",
            phone="573001234567",
        )
        session.add(contact)
        await session.commit()
        print(f"Insertado:  {contact.id}")

    async with async_session() as session:
        result = await session.get(Contact, contact.id)
        assert result is not None
        print(f"Consultado: {result.name} ({result.wa_id})")

    async with async_session() as session:
        result = await session.get(Contact, contact.id)
        await session.delete(result)
        await session.commit()
        print("Eliminado:  registro de prueba limpiado")

    print("\nTest de Contact completado exitosamente.")


if __name__ == "__main__":
    asyncio.run(test())
