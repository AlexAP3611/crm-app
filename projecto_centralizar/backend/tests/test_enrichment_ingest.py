import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

# Allow running from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app.models.empresa import Empresa
from app.schemas.enrichment import IngestRequest, IngestEmpresaInput
from app.services.enrichment_ingest_service import bulk_ingest


def _setup_mock_session():
    session = AsyncMock()
    # Mock database begin_nested context manager
    session.begin_nested = MagicMock()
    session.begin_nested.return_value.__aenter__ = AsyncMock()
    session.begin_nested.return_value.__aexit__ = AsyncMock()
    return session


@pytest.mark.anyio
@patch("app.services.enrichment_ingest_service.validate_empresa")
@patch("app.services.enrichment_ingest_service.process_contacts")
async def test_bulk_ingest_empresa_protection(mock_process_contacts, mock_validate_empresa):
    # Mock database session
    session = _setup_mock_session()
    
    # Configure mock for process_contacts (return 0 created, 0 updated, 0 skipped)
    mock_process_contacts.return_value = (0, 0, 0)
    
    # 1. Setup mock Empresa with existing values in protected fields (web, email, phone)
    # and some empty fields
    empresa = Empresa(
        id=42,
        nombre="Test Empresa",
        web="https://manual-web.com",
        email="manual@empresa.com",
        phone="600111222",
        cif=None,
        numero_empleados=10,
        facturacion=None
    )
    mock_validate_empresa.return_value = empresa
    
    # 2. Build incoming IngestRequest payload
    # This payload has new values for protected fields, plus some new values for empty/non-protected fields
    body = IngestRequest(
        source="apollo",
        empresas=[
            IngestEmpresaInput(
                empresa_id=42,
                web="https://apollo-enriched-web.com", # Protected & exists -> should NOT overwrite
                email="apollo@enriched-email.com",     # Protected & exists -> should NOT overwrite
                phone="900888777",                     # Protected & exists -> should NOT overwrite
                cif="A1234567B",                        # Non-protected -> should update
                numero_empleados=50,                   # Non-protected -> should update
                facturacion=5000000.0                  # Non-protected -> should update
            )
        ]
    )
    
    # Execute bulk_ingest
    response = await bulk_ingest(session, body)
    
    # Verify response
    assert response.status == "success"
    assert response.empresa_processed == 1
    assert response.empresa_skipped == 0
    
    # Verify protected fields were NOT overwritten
    assert empresa.web == "https://manual-web.com"
    assert empresa.email == "manual@empresa.com"
    assert empresa.phone == "600111222"
    
    # Verify non-protected / originally empty fields WERE updated
    assert empresa.cif == "A1234567B"
    assert empresa.numero_empleados == 50
    assert empresa.facturacion == 5000000.0
    
    # Verify company enrichment status is updated to success
    assert empresa.enrichment_status == "success"
    assert empresa.last_enriched_at is not None


@pytest.mark.anyio
@patch("app.services.enrichment_ingest_service.validate_empresa")
@patch("app.services.enrichment_ingest_service.process_contacts")
async def test_bulk_ingest_empresa_write_if_empty(mock_process_contacts, mock_validate_empresa):
    session = _setup_mock_session()
    mock_process_contacts.return_value = (0, 0, 0)
    
    # Setup mock Empresa with empty values in protected fields
    empresa = Empresa(
        id=42,
        nombre="Test Empresa",
        web=None,
        email="",
        phone=None
    )
    mock_validate_empresa.return_value = empresa
    
    # Incoming payload with values for previously empty protected fields
    body = IngestRequest(
        source="apollo",
        empresas=[
            IngestEmpresaInput(
                empresa_id=42,
                web="https://new-web.com",
                email="new-email@empresa.com",
                phone="123456789"
            )
        ]
    )
    
    # Execute
    await bulk_ingest(session, body)
    
    # Verify protected fields were updated since they were previously empty or None
    assert empresa.web == "https://new-web.com"
    assert empresa.email == "new-email@empresa.com"
    assert empresa.phone == "123456789"
