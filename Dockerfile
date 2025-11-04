# syntax=docker/dockerfile:1
FROM python:3.10-slim

# Install system dependencies (ffmpeg for audio transcoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python dependencies
COPY pip_requirements.txt /app/pip_requirements.txt
RUN pip install --no-cache-dir -r pip_requirements.txt

# Copy app
COPY . /app

# Environment
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Expose port (Railway sets $PORT)
EXPOSE 8080

# Default command for Gunicorn with eventlet worker
CMD exec gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:${PORT:-8080} backend.web_app:app


