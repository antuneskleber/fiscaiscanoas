FROM python:3.12-slim

WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend

EXPOSE 8000
VOLUME ["/app/backend/storage"]
CMD ["python", "backend/app.py", "--host", "0.0.0.0", "--port", "8000"]
