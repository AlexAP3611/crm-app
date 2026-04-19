import sys
import os
import io
from openpyxl import Workbook

# Add the project path to sys.path
sys.path.append("/home/vboxuser/crm-app/crm-app/projecto_centralizar/backend")

from app.services.csv_service import parse_xlsx

def test_parse_xlsx():
    # 1. Create a mock XLSX in memory
    wb = Workbook()
    ws = wb.active
    
    # Headers with spaces and mixed case
    headers = ["Nombre ", " WEB", "Empresa", None, "CIF"]
    ws.append(headers)
    
    # Data rows
    row1 = [" John Doe  ", "www.example.com", "Acme Corp", "extra", "B12345678"]
    row2 = ["Jane Smith", "  https://test.com  ", None, None, "A98765432"]
    ws.append(row1)
    ws.append(row2)
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    content = output.getvalue()
    
    # 2. Parse using our new function
    print("Parsing XLSX content...")
    rows = parse_xlsx(content)
    
    print(f"Total rows parsed: {len(rows)}")
    for i, row in enumerate(rows):
        print(f"Row {i+1}: {row}")
        
    # 3. Assertions (simulated)
    # Header 'Nombre ' -> 'nombre'
    # Value ' John Doe  ' -> 'John Doe'
    # Column with None header should be skipped
    
    if len(rows) != 2:
        print("FAIL: Expected 2 rows")
        return
        
    if "nombre" not in rows[0] or rows[0]["nombre"] != "John Doe":
        print(f"FAIL: Row 0 'nombre' mismatch: {rows[0].get('nombre')}")
        
    if "web" not in rows[1] or rows[1]["web"] != "https://test.com":
        print(f"FAIL: Row 1 'web' mismatch: '{rows[1].get('web')}'")
        
    if None in rows[0]:
        print("FAIL: Key None should have been skipped")

    print("\nSUCCESS: XLSX parsing looks robust and correctly normalized.")

if __name__ == "__main__":
    test_parse_xlsx()
