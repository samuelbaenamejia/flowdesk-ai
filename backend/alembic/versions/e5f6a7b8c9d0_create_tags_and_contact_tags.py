"""create tags and contact_tags tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-30 20:01:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#6366f1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_unique_constraint("uq_tags_name", "tags", ["name"])

    op.create_table(
        "contact_tags",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "contact_id",
            sa.Uuid,
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tag_id",
            sa.Uuid,
            sa.ForeignKey("tags.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_unique_constraint(
        "uq_contact_tags_pair", "contact_tags", ["contact_id", "tag_id"]
    )
    op.create_index("idx_contact_tags_contact_id", "contact_tags", ["contact_id"])
    op.create_index("idx_contact_tags_tag_id", "contact_tags", ["tag_id"])


def downgrade() -> None:
    op.drop_index("idx_contact_tags_tag_id", table_name="contact_tags")
    op.drop_index("idx_contact_tags_contact_id", table_name="contact_tags")
    op.drop_constraint("uq_contact_tags_pair", "contact_tags", type_="unique")
    op.drop_table("contact_tags")
    op.drop_constraint("uq_tags_name", "tags", type_="unique")
    op.drop_table("tags")
