import sys
import os

# Allow running from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app.models.empresa import Empresa, Competidor
from app.services.validators import AdscoreCompanyValidator


@pytest.mark.anyio
async def test_adscore_validator_success():
    validator = AdscoreCompanyValidator()
    
    # Valid case: company has web, facebook and at least one competitor with web and facebook
    emp = Empresa(
        id=1,
        nombre="Company A",
        web="https://company-a.com",
        facebook="https://facebook.com/company-a",
        competidores=[
            Competidor(posicion=1, web="https://comp1.com", facebook="https://facebook.com/comp1"),
            Competidor(posicion=2, web="https://comp2.com", facebook=""),
        ]
    )
    
    invalid = await validator.validate([emp])
    assert len(invalid) == 0


@pytest.mark.anyio
async def test_adscore_validator_missing_all():
    validator = AdscoreCompanyValidator()
    
    # Invalid case: missing web, facebook, and competitors
    emp = Empresa(
        id=2,
        nombre="Company B",
        web="",
        facebook=None,
        competidores=[]
    )
    
    invalid = await validator.validate([emp])
    assert len(invalid) == 1
    assert invalid[0].id == 2
    assert invalid[0].nombre == "Company B"
    assert invalid[0].reason == "missing_web&missing_facebook&missing_competitors"


@pytest.mark.anyio
async def test_adscore_validator_missing_competitor_facebook():
    validator = AdscoreCompanyValidator()
    
    # Invalid case: company has web and facebook, but competitors lack facebook or web
    emp = Empresa(
        id=3,
        nombre="Company C",
        web="https://company-c.com",
        facebook="https://facebook.com/company-c",
        competidores=[
            Competidor(posicion=1, web="https://comp1.com", facebook=None),
            Competidor(posicion=2, web="", facebook="https://facebook.com/comp2"),
        ]
    )
    
    invalid = await validator.validate([emp])
    assert len(invalid) == 1
    assert invalid[0].id == 3
    assert invalid[0].reason == "missing_competitors"


@pytest.mark.anyio
async def test_adscore_validator_partial_errors():
    validator = AdscoreCompanyValidator()
    
    # Invalid case: company has web, but missing facebook, and competitors are missing web/facebook
    emp = Empresa(
        id=4,
        nombre="Company D",
        web="https://company-d.com",
        facebook="   ",
        competidores=[
            Competidor(posicion=1, web="https://comp1.com", facebook=""),
        ]
    )
    
    invalid = await validator.validate([emp])
    assert len(invalid) == 1
    assert invalid[0].id == 4
    assert invalid[0].reason == "missing_facebook&missing_competitors"
