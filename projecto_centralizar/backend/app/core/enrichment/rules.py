"""
Business logic rules for the enrichment domain.
Strictly declarative constants defining how enrichment interacts with existing data.
"""

# Fields that should NOT be overwritten during automatic enrichment.
# If a new value arrives, it is redirected to notes[source]["_enrichment_{field}"].
ENRICHMENT_PROTECTED_FIELDS = {"web", "email", "phone"}
