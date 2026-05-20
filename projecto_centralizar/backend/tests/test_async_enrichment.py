import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta
from uuid import uuid4

# Allow running from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app.models.empresa import Empresa
from app.models.enrichment_log import IntegrationLog as EnrichmentLog
from app.schemas.enrichment import IngestRequest, IngestEmpresaInput
from app.services.enrichment_ingest_service import bulk_ingest
from app.services.expire_stale_enrichments import expire_stale_runs
from app.config import settings


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
async def test_bulk_ingest_ignores_expired_run(mock_process_contacts, mock_validate_empresa):
    session = _setup_mock_session()
    mock_process_contacts.return_value = (0, 0, 0)
    
    # 1. Setup expired log entry mock
    run_id = uuid4()
    expired_log = EnrichmentLog(
        run_id=run_id,
        tool="test",
        status="expired",
        metrics={"total": 1, "sent": 1, "invalid": 0}
    )
    
    session.get.return_value = expired_log

    body = IngestRequest(
        source="n8n",
        enrichment_run_id=run_id,
        empresas=[
            IngestEmpresaInput(
                empresa_id=42,
                web="https://new-web.com",
                contactos=[]
            )
        ]
    )
    
    # 2. Execute
    response = await bulk_ingest(session, body)
    
    # 3. Verify that response status is ignored and processing was skipped
    assert response.status == "ignored"
    assert response.empresa_processed == 0
    assert response.empresa_skipped == 1
    
    # Ensure validate_empresa was never called
    mock_validate_empresa.assert_not_called()


@pytest.mark.anyio
@patch("app.services.enrichment_ingest_service.validate_empresa")
@patch("app.services.enrichment_ingest_service.process_contacts")
async def test_bulk_ingest_completes_active_run(mock_process_contacts, mock_validate_empresa):
    session = _setup_mock_session()
    mock_process_contacts.return_value = (1, 2, 3)  # 1 created, 2 updated, 3 skipped
    
    empresa = Empresa(
        id=42,
        nombre="Test Empresa",
        web=None
    )
    mock_validate_empresa.return_value = empresa

    # Setup active log entry mock
    run_id = uuid4()
    active_log = EnrichmentLog(
        run_id=run_id,
        tool="test",
        status="sent",
        metrics={"total": 1, "sent": 1, "invalid": 0}
    )
    
    # Return active_log on db.get() call
    session.get.return_value = active_log

    body = IngestRequest(
        source="n8n",
        enrichment_run_id=run_id,
        empresas=[
            IngestEmpresaInput(
                empresa_id=42,
                web="https://completed-web.com",
                contactos=[]
            )
        ]
    )
    
    # Execute
    response = await bulk_ingest(session, body)
    
    # Verify response
    assert response.status == "success"
    assert response.empresa_processed == 1
    assert active_log.status == "completed"
    assert active_log.metrics["empresa_processed"] == 1
    assert active_log.metrics["contact_created"] == 1
    assert active_log.metrics["contact_updated"] == 2
    assert active_log.metrics["contact_skipped"] == 3


@pytest.mark.anyio
async def test_expire_stale_runs():
    session = _setup_mock_session()
    
    # Mock date older than timeout
    stale_date = datetime.now(timezone.utc) - timedelta(minutes=settings.ENRICHMENT_TIMEOUT_MINUTES + 10)
    
    # Setup stale logs and mock session execute result
    run_id = uuid4()
    stale_log = EnrichmentLog(
        run_id=run_id,
        tool="test",
        status="sent",
        created_at=stale_date
    )
    
    mock_execute_result = MagicMock()
    mock_execute_result.scalars.return_value.all.return_value = [stale_log]
    session.execute.return_value = mock_execute_result
    
    # Execute expiration service
    result = await expire_stale_runs(session)
    
    # Verify result
    assert result["expired"] == 1
    assert stale_log.status == "expired"
    assert "Auto-expired" in stale_log.error_log
    
    # Ensure commit was called
    assert session.commit.called
