"""
Pure DTO <-> ORM field mapping for Contact entity.
This layer is strictly declarative and contains no business logic.
"""

CONTACT_FIELD_MAP = {
    # payload key -> db column
    "first_name": "first_name",
    "nombre": "first_name",
    "last_name": "last_name",
    "apellido": "last_name",
    "cif": "cif",
    "website": "web",
    "web": "web",
    "linkedin": "linkedin",
    "email": "email",
    "phone": "phone",
}
