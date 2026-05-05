from abc import ABC, abstractmethod
from typing import Any, Optional
from app.models.contact import Contact
from app.schemas.tool import ToolKey, InvalidEntity, ToolValidationError
from app.models.empresa import Empresa

class ToolValidationErrorException(Exception):
    def __init__(self, error: ToolValidationError):
        self.error = error
        super().__init__(error.message)

class BaseToolValidator(ABC):
    """
    Base class for all tool-specific validators.
    """
    @abstractmethod
    async def validate(self, entities: list[Any]) -> list[InvalidEntity]:
        """
        Validate a list of entities (Contacts or Companies).
        Returns a list of InvalidEntity if any validation fails.
        """
        pass

class AffinoContactValidator(BaseToolValidator):
    """
    Strict validation for Affino:
    1. Must have email (or email_generic).
    2. Must have an associated company.
    """
    async def validate(self, contacts: list[Contact]) -> list[InvalidEntity]:
        invalid = []
        for c in contacts:
            reasons = []
            
            # 1. Check Email (Strict: must have personal email)
            # FUTURE: Could include c.email_generic here as fallback if business rules change.
            email = (c.email or "").strip()
            if not email:
                reasons.append("missing_email")
                
            # 2. Check Company
            if not c.empresa_id and not c.empresa_rel:
                reasons.append("missing_company")
                
            if reasons:
                # Format name for display
                nombre = f"{c.first_name or ''} {c.last_name or ''}".strip() or f"ID: {c.id}"
                invalid.append(InvalidEntity(
                    id=c.id,
                    nombre=nombre,
                    reason="&".join(reasons)
                ))
        return invalid

class ClayCompanyValidator(BaseToolValidator):
    """
    Validation for Clay (Companies):
    1. Must have web.
    """
    async def validate(self, companies: list[Empresa]) -> list[InvalidEntity]:
        invalid = []
        for emp in companies:
            if not emp.web or not str(emp.web).strip():
                invalid.append(InvalidEntity(
                    id=emp.id,
                    nombre=emp.nombre,
                    reason="missing_web"
                ))
        return invalid

class ApolloCompanyValidator(BaseToolValidator):
    """
    Validation for Apollo (Companies):
    1. Must have web.
    """
    async def validate(self, companies: list[Empresa]) -> list[InvalidEntity]:
        invalid = []
        for emp in companies:
            if not emp.web or not str(emp.web).strip():
                invalid.append(InvalidEntity(
                    id=emp.id,
                    nombre=emp.nombre,
                    reason="missing_web"
                ))
        return invalid

class AdscoreCompanyValidator(BaseToolValidator):
    """
    Strict validation for Adscore:
    1. Must have web.
    2. Must have facebook.
    3. Must have at least one competitor.
    """
    async def validate(self, companies: list[Empresa]) -> list[InvalidEntity]:
        invalid = []
        for emp in companies:
            reasons = []
            
            # 1. Web
            if not emp.web or not str(emp.web).strip():
                reasons.append("missing_web")
            
            # 2. Facebook
            if not emp.facebook or not str(emp.facebook).strip():
                reasons.append("missing_facebook")
            
            # 3. Competitors
            has_competitor = any([
                emp.web_competidor_1 and str(emp.web_competidor_1).strip(),
                emp.web_competidor_2 and str(emp.web_competidor_2).strip(),
                emp.web_competidor_3 and str(emp.web_competidor_3).strip()
            ])
            if not has_competitor:
                reasons.append("missing_competitors")
                
            if reasons:
                invalid.append(InvalidEntity(
                    id=emp.id,
                    nombre=emp.nombre,
                    reason="&".join(reasons)
                ))
        return invalid

# Registry of validators
_VALIDATORS = {
    ToolKey.AFFINO: AffinoContactValidator(),
    ToolKey.CLAY: ClayCompanyValidator(),
    ToolKey.APOLLO: ApolloCompanyValidator(),
    ToolKey.ADSCORE: AdscoreCompanyValidator()
}

def get_validator(tool_key: ToolKey) -> Optional[BaseToolValidator]:
    """
    Returns the validator for a specific tool if it exists.
    """
    return _VALIDATORS.get(tool_key)
