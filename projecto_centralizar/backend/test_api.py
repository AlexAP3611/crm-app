from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("--- Testing Create Campaign ---")
response = client.post("/api/campaigns", json={
    "nombre": "Campaña Test Spanish Fields",
    "tipo": "Fidelización",
    "estado": "Planeada",
    "fecha_inicio": "2026-03-18T10:00:00Z",
    "canal": "Email, SMS",
    "presupuesto": 999.50
})
print("CREATE STATUS:", response.status_code)
print("CREATE BODY:", response.json())

print("\n--- Testing List Campaigns ---")
response = client.get("/api/campaigns")
print("LIST STATUS:", response.status_code)
print("LIST CAMPAIGNS:")
for c in response.json():
    print(f"- {c['nombre']} | {c['tipo']} | {c['canal']} | Presupuesto: {c['presupuesto']}")

