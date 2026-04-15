"""settings_value_jsonb

Revision ID: b3928795493f
Revises: bf56b7ab9bdd
Create Date: 2026-04-15 13:45:11.080576

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3928795493f'
down_revision: Union[str, Sequence[str], None] = 'bf56b7ab9bdd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Convert existing TEXT 'value' to JSONB. 
    # to_jsonb(value) safely turns existing strings like "crm_..." into valid JSON strings.
    op.execute("ALTER TABLE settings ALTER COLUMN value TYPE JSONB USING to_jsonb(value)")


def downgrade() -> None:
    """Downgrade schema."""
    # We use #>> '{}' to convert JSONB back to plain text
    op.execute("ALTER TABLE settings ALTER COLUMN value TYPE TEXT USING value#>>'{}'")
