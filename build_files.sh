#!/bin/bash
# Build script for Vercel Deployment

echo "Building project packages..."
python3 -m pip install -r requirements.txt

echo "Collecting static files..."
python3 manage.py collectstatic --noinput --clear

echo "Applying database migrations..."
python3 manage.py migrate --noinput || true

echo "Build process complete!"
