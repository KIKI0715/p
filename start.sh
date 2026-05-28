#!/usr/bin/env bash
set -e

# ── 1. Check prerequisites ────────────────────────────────────────────────────
command -v docker   >/dev/null 2>&1 || { echo "ERROR: docker is not installed."; exit 1; }
command -v flutter  >/dev/null 2>&1 || { echo "ERROR: flutter SDK is not installed."; exit 1; }

# ── 2. Ensure backend/.env exists ────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  echo "backend/.env not found. Creating from .env.example..."
  cp backend/.env.example backend/.env
  echo ""
  echo "IMPORTANT: Edit backend/.env and fill in:"
  echo "  JWT_SECRET       (32+ random chars)"
  echo "  ENCRYPTION_KEY   (exactly 32 chars)"
  echo "  OPENAI_API_KEY   (your OpenAI key)"
  echo ""
  echo "Then run ./start.sh again."
  exit 1
fi

# ── 3. Start MongoDB + backend via Docker Compose ─────────────────────────────
echo "Starting MongoDB + backend..."
docker compose up -d --build

echo ""
echo "Waiting for backend to be ready..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    echo "Backend is up at http://localhost:3000"
    break
  fi
  sleep 2
done

# ── 4. Launch Flutter app ─────────────────────────────────────────────────────
echo ""
echo "Launching Flutter app..."
echo "  Android emulator → API at http://10.0.2.2:3000/api (default)"
echo "  iOS simulator    → run: flutter run --dart-define=API_BASE_URL=http://localhost:3000/api"
echo "  Physical device  → run: flutter run --dart-define=API_BASE_URL=http://YOUR_LOCAL_IP:3000/api"
echo ""
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
