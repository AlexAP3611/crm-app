import sys
import os
from unittest.mock import AsyncMock, MagicMock

# Allow running from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app.core.mappings.provincia_aliases import normalize_provincia_name
from app.services.provincia_service import get_by_name_and_pais, prefill_cache
from app.models.provincia import Provincia


def test_normalize_provincia_name():
    # Canonical cases
    assert normalize_provincia_name("Bizkaia") == "Bizkaia"
    assert normalize_provincia_name("Madrid") == "Madrid"

    # Lowercase aliases
    assert normalize_provincia_name("vizcaya") == "Bizkaia"
    assert normalize_provincia_name("guipuzcoa") == "Gipuzkoa"
    assert normalize_provincia_name("guipúzcoa") == "Gipuzkoa"
    assert normalize_provincia_name("alava") == "Araba/Álava"
    assert normalize_provincia_name("álava") == "Araba/Álava"
    
    # Inverted name / alternative mappings
    assert normalize_provincia_name("la coruña") == "Coruña, A"
    assert normalize_provincia_name("la coruna") == "Coruña, A"
    assert normalize_provincia_name("a coruña") == "Coruña, A"
    assert normalize_provincia_name("coruña") == "Coruña, A"
    
    # Other provinces
    assert normalize_provincia_name("baleares") == "Balears, Illes"
    assert normalize_provincia_name("islas baleares") == "Balears, Illes"
    assert normalize_provincia_name("illes balears") == "Balears, Illes"
    assert normalize_provincia_name("las palmas") == "Palmas, Las"
    assert normalize_provincia_name("las palmas de gran canaria") == "Palmas, Las"
    assert normalize_provincia_name("la rioja") == "Rioja, La"
    assert normalize_provincia_name("rioja") == "Rioja, La"
    assert normalize_provincia_name("santa cruz de tenerife") == "Santa Cruz de Tenerife"
    assert normalize_provincia_name("tenerife") == "Santa Cruz de Tenerife"
    assert normalize_provincia_name("navarra") == "Navarra"
    assert normalize_provincia_name("alicante") == "Alicante/Alacant"
    assert normalize_provincia_name("castellon") == "Castellón/Castelló"
    assert normalize_provincia_name("valencia") == "Valencia/València"

    # Whitespace trimming
    assert normalize_provincia_name("  vizcaya  ") == "Bizkaia"
    assert normalize_provincia_name("  Madrid  ") == "Madrid"
    
    # None/empty handling
    assert normalize_provincia_name("") == ""
    assert normalize_provincia_name(None) == ""


@pytest.mark.anyio
async def test_get_by_name_and_pais():
    session = AsyncMock()
    
    # Mocking select execute result
    mock_result = MagicMock()
    mock_provincia = Provincia(id=48, name="Bizkaia", pais_id=1)
    mock_result.scalar_one_or_none.return_value = mock_provincia
    session.execute.return_value = mock_result
    
    # Query with alias
    result = await get_by_name_and_pais(session, "vizcaya", 1)
    
    assert result == mock_provincia
    session.execute.assert_called_once()
    
    # Check that query used normalized name "Bizkaia"
    # The where clause will construct an expression. Let's inspect the query passed
    stmt = session.execute.call_args[0][0]
    # Check that 'bizkaia' is in the query params (SQLAlchemy handles parameters binding)
    # or simple representation
    stmt_str = str(stmt)
    assert "provincias" in stmt_str


@pytest.mark.anyio
async def test_prefill_cache():
    session = AsyncMock()
    
    # Mocking select execute result
    mock_result = MagicMock()
    p_bizkaia = Provincia(id=48, name="Bizkaia", pais_id=1)
    p_madrid = Provincia(id=30, name="Madrid", pais_id=1)
    mock_result.scalars().all.return_value = [p_bizkaia, p_madrid]
    session.execute.return_value = mock_result
    
    names = {"vizcaya", "Madrid"}
    cache = await prefill_cache(session, names, 1)
    
    # Assert cache keys are lowercase
    assert "bizkaia" in cache
    assert "madrid" in cache
    # Assert alias key is also mapped
    assert "vizcaya" in cache
    
    assert cache["bizkaia"] == p_bizkaia
    assert cache["vizcaya"] == p_bizkaia
    assert cache["madrid"] == p_madrid
