FROM python:3.12-slim

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY src ./src

RUN uv sync --frozen --no-dev

EXPOSE 8000
# Shell form on purpose: Render injects PORT and exec-form CMD does no variable
# expansion. The ${PORT:-8000} default keeps docker-compose.yml (which maps
# 8000:8000 and sets no PORT) working unchanged.
CMD uv run uvicorn petri_backend.app:app --host 0.0.0.0 --port ${PORT:-8000}
