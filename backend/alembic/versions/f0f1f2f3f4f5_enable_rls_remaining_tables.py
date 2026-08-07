"""enable row-level security on remaining tables (refresh_tokens, tags, contact_tags)

Revision ID: f0f1f2f3f4f5
Revises: a7b8c9d0e1f2
Create Date: 2026-08-04 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'f0f1f2f3f4f5'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Estas tablas se crearon DESPUÉS de la migración RLS original
# (b2c3d4e5f6a7), que solo cubría users/contacts/conversations/messages.
# Quedaron fuera de RLS; las migraciones c3d4e5f6a7b8 (refresh_tokens) y
# e5f6a7b8c9d0 (tags, contact_tags) las crearon sin el flag.
TABLES = ["refresh_tokens", "tags", "contact_tags"]


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in reversed(TABLES):
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")