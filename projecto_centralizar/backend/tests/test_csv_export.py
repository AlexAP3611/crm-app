"""
Unit tests for csv_service export functions.

Coverage:
- _contact_to_row: verifies csv_version is never present in row output
- _empresa_to_row: verifies csv_version is never present in row output
- CSV_FIELDS: verifies Version_CSV is not in the translated header list
- EMPRESA_CSV_FIELDS: verifies Version_CSV is not in the translated header list

Run with:
    cd backend && python -m pytest tests/test_csv_export.py -v
"""
import sys
import os

# Allow running from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock


def _make_mock_contact() -> MagicMock:
    """Build a minimal mock Contact object that satisfies _contact_to_row."""
    contact = MagicMock()
    contact.cargo = None          # no cargo — simplest path
    contact.empresa_rel = None    # no empresa
    # CONTACT_VIEW_FIELDS: first_name, last_name, email, phone, linkedin
    contact.first_name = "Test"
    contact.last_name = "User"
    contact.email = "test@example.com"
    contact.phone = "600000000"
    contact.linkedin = None
    # M2M: campaigns (contact level)
    contact.campaigns = []
    return contact


def _make_mock_empresa() -> MagicMock:
    """Build a minimal mock Empresa object that satisfies _empresa_to_row."""
    empresa = MagicMock()
    empresa.pais_rel = None
    empresa.provincia_rel = None
    # EMPRESA_VIEW_FIELDS scalar attributes
    empresa.nombre = "Empresa Test"
    empresa.web = "example.com"
    empresa.email = "info@example.com"
    empresa.phone = "911000000"
    empresa.cif = "B12345678"
    empresa.numero_empleados = 50
    empresa.facturacion = 1000000.0
    empresa.cnae = "6201"
    empresa.pais_id = None
    empresa.provincia_id = None
    empresa.facebook = None
    empresa.competidores = []
    # M2M: sectors, verticals, products
    empresa.sectors = []
    empresa.verticals = []
    empresa.products_rel = []
    return empresa


# ────────────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────────────

def test_contact_row_has_no_csv_version():
    """_contact_to_row must never include 'csv_version' in its output."""
    from app.services.csv_service import _contact_to_row
    row = _contact_to_row(_make_mock_contact())
    assert "csv_version" not in row, (
        f"'csv_version' found in _contact_to_row output. Keys: {list(row.keys())}"
    )


def test_empresa_row_has_no_csv_version():
    """_empresa_to_row must never include 'csv_version' in its output."""
    from app.services.csv_service import _empresa_to_row
    row = _empresa_to_row(_make_mock_empresa())
    assert "csv_version" not in row, (
        f"'csv_version' found in _empresa_to_row output. Keys: {list(row.keys())}"
    )


def test_contact_csv_headers_have_no_version_csv():
    """The translated CSV_FIELDS headers must not include 'Version_CSV'."""
    from app.services.csv_service import CSV_FIELDS, HEADER_MAP
    translated = [HEADER_MAP.get(f, f) for f in CSV_FIELDS]
    assert "Version_CSV" not in translated, (
        f"'Version_CSV' found in contact CSV headers: {translated}"
    )


def test_empresa_csv_headers_have_no_version_csv():
    """The translated EMPRESA_CSV_FIELDS headers must not include 'Version_CSV'."""
    from app.services.csv_service import EMPRESA_CSV_FIELDS, HEADER_MAP
    translated = [HEADER_MAP.get(f, f) for f in EMPRESA_CSV_FIELDS]
    assert "Version_CSV" not in translated, (
        f"'Version_CSV' found in empresa CSV headers: {translated}"
    )



def test_empresa_to_row_resolves_location_names():
    """_empresa_to_row must resolve pais_rel.name and provincia_rel.name to 'pais' and 'provincia' fields."""
    from app.services.csv_service import _empresa_to_row
    empresa = _make_mock_empresa()
    
    mock_pais = MagicMock()
    mock_pais.name = "España"
    empresa.pais_rel = mock_pais
    
    mock_provincia = MagicMock()
    mock_provincia.name = "Madrid"
    empresa.provincia_rel = mock_provincia
    
    row = _empresa_to_row(empresa)
    assert row.get("pais") == "España"
    assert row.get("provincia") == "Madrid"
    assert "pais_id" not in row
    assert "provincia_id" not in row


def test_empresa_csv_headers_contain_pais_and_provincia():
    """The translated EMPRESA_CSV_FIELDS headers must include 'Pais' and 'Provincia' and NOT 'pais_id'/'provincia_id'."""
    from app.services.csv_service import EMPRESA_CSV_FIELDS, HEADER_MAP
    translated = [HEADER_MAP.get(f, f) for f in EMPRESA_CSV_FIELDS]
    assert "Pais" in translated
    assert "Provincia" in translated
    assert "pais_id" not in translated
    assert "provincia_id" not in translated


def test_empresa_to_row_resolves_competidores():
    """_empresa_to_row must resolve competitors from relationship."""
    from app.services.csv_service import _empresa_to_row
    empresa = _make_mock_empresa()
    
    comp1 = MagicMock()
    comp1.posicion = 1
    comp1.web = "competidor1.com"
    comp1.facebook = "fb.com/comp1"
    
    comp3 = MagicMock()
    comp3.posicion = 3
    comp3.web = "competidor3.com"
    comp3.facebook = ""
    
    empresa.competidores = [comp1, comp3]
    
    row = _empresa_to_row(empresa)
    assert row.get("web_competidor_1") == "competidor1.com"
    assert row.get("facebook_competidor_1") == "fb.com/comp1"
    assert row.get("web_competidor_2") == ""
    assert row.get("facebook_competidor_2") == ""
    assert row.get("web_competidor_3") == "competidor3.com"
    assert row.get("facebook_competidor_3") == ""


def test_csv_version_constant_removed():
    """CSV_VERSION constant must no longer be exported from csv_service."""
    import app.services.csv_service as svc
    assert not hasattr(svc, "CSV_VERSION"), (
        "csv_service still exports 'CSV_VERSION' — constant was not fully removed."
    )


if __name__ == "__main__":
    # Allow running directly: python tests/test_csv_export.py
    import traceback
    tests = [
        test_contact_row_has_no_csv_version,
        test_empresa_row_has_no_csv_version,
        test_contact_csv_headers_have_no_version_csv,
        test_empresa_csv_headers_have_no_version_csv,
        test_empresa_to_row_resolves_location_names,
        test_empresa_csv_headers_contain_pais_and_provincia,
        test_empresa_to_row_resolves_competidores,
        test_csv_version_constant_removed,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  ✅ PASS  {t.__name__}")
            passed += 1
        except Exception:
            print(f"  ❌ FAIL  {t.__name__}")
            traceback.print_exc()
    print(f"\n{passed}/{len(tests)} tests passed.")
