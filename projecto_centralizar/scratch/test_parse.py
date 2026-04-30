from app.services import csv_service
import io

def test_parse():
    content = b"nombre,web,facebook\nGoogle,google.com,fb.com/google"
    rows = csv_service.parse_file(content, "test.csv")
    print(f"Parsed {len(rows)} rows")
    print(rows[0])

if __name__ == "__main__":
    test_parse()
