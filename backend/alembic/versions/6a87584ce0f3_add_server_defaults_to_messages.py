"""add_server_defaults_to_messages

Revision ID: 6a87584ce0f3
Revises: 042be1bcb17e
Create Date: 2026-07-24 00:46:57.244746
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6a87584ce0f3'
down_revision: Union[str, None] = '042be1bcb17e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "messages",
        "content_type",
        server_default="text",
    )
    op.alter_column(
        "messages",
        "status",
        server_default="sent",
    )


def downgrade() -> None:
    op.alter_column(
        "messages",
        "content_type",
        server_default=None,
    )
    op.alter_column(
        "messages",
        "status",
        server_default=None,
    )
