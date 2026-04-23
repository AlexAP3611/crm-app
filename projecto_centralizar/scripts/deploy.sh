#!/bin/bash
set -euo pipefail

echo "=== CRM Deploy ==="

# 1. Pull latest code
cd /home/vboxuser/crm-app/crm-app/projecto_centralizar
git pull origin main

# 2. Backend: install deps + run migrations
cd backend
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "→ Running Alembic migrations..."
alembic upgrade head

# 3. Frontend: build
cd ../frontend
npm ci --silent
npm run build

# 4. Restart services
sudo systemctl restart crm-backend
sudo systemctl restart nginx  # o el proxy que uses

echo "=== Deploy complete ==="
