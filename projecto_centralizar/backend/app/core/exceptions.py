class DuplicateEntityError(Exception):
    """Raised when an entity with the same unique identifier (e.g., name) already exists."""
    def __init__(self, message: str = "Entity already exists"):
        self.message = message
        super().__init__(self.message)
