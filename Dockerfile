FROM python:3.11-slim as builder

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[all]"

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

ENV ZORAOS_ENV=production
ENV ZORAOS_LOG_LEVEL=INFO

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
