"""add email, notes, last_contacted_at, deleted_at to contacts; make wa_id nullable

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-30 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("contacts", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("contacts", sa.Column("notes", sa.Text, nullable=True))
    op.add_column(
        "contacts",
        sa.Column("last_contacted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "contacts",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.alter_column("contacts", "wa_id", nullable=True)
    op.create_index("idx_contacts_name", "contacts", ["name"])
    op.create_index("idx_contacts_phone", "contacts", ["phone"])
    op.create_index("idx_contacts_email", "contacts", ["email"])
    op.create_index("idx_contacts_deleted_at", "contacts", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("idx_contacts_deleted_at", table_name="contacts")
    op.drop_index("idx_contacts_email", table_name="contacts")
    op.drop_index("idx_contacts_phone", table_name="contacts")
    op.drop_index("idx_contacts_name", table_name="contacts")
    op.execute(
        "UPDATE contacts SET wa_id = 'orphan_' || id::text WHERE wa_id IS NULL"
    )
    op.alter_column("contacts", "wa_id", nullable=False)
    op.drop_column("contacts", "deleted_at")
    op.drop_column("contacts", "last_contacted_at")
    op.drop_column("contacts", "notes")
    op.drop_column("contacts", "email")
