# CRM Application

Fullstack CRM built with **FastAPI + PostgreSQL + React**.

## Requirements

- Python 3.11+
- Node.js 18+
- PostgreSQL running locally with a database named `crm`

---

## Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` (already provided — update credentials if needed):
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/crm
```

Start the server:
```bash
uvicorn app.main:app --reload
```

⚡ Tables are **auto-created on first startup** via SQLAlchemy.

API docs: http://localhost:8000/docs

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

---

## Key Design Decisions

| Rule | Detail |
|------|--------|
| Required fields | `id` (auto) + `company` only |
| All other fields | Nullable — filled progressively via enrichment |
| Upsert logic | CIF → Website → create new |
| Unique constraints | `cif`, `website` (multiple NULLs allowed) |
| `notes` JSONB | Deep-merged on every update — never replaced |
| CSV import | Respects upsert logic row-by-row |
| CSV export | Filtered — exports only matching contacts |

---

## Project Structure

```
projecto_centralizar/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── config.py        # Settings (.env)
│   │   ├── database.py      # Async SQLAlchemy
│   │   ├── models/          # Contact, Sector, Vertical, Campaign
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routers/         # contacts, csv, enrichment, lookup
│   │   └── services/        # contact_service, csv_service, enrichment_service, merge
│   ├── .env
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api/client.js
    │   ├── hooks/useContacts.js
    │   └── components/
    │       ├── ContactsTable.jsx
    │       ├── FilterPanel.jsx
    │       ├── ContactModal.jsx
    │       └── CSV.jsx
    └── package.json
```
