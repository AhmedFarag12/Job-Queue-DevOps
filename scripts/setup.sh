#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env found, creating one from .env.example..."
  cp .env.example .env

  jwt_secret="$(openssl rand -hex 48)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" .env

  echo ".env created with a random JWT_SECRET."
  echo "Edit .env now and set your real MONGODB_URI, then run this script again."
  exit 1
fi

echo "Building and starting the job-system stack..."
docker compose up -d --build
