FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install poetry

# Copy project files
COPY pyproject.toml ./
RUN poetry config virtualenvs.create false \
    && poetry install --without dev --no-interaction --no-ansi --no-root

# Copy app code
COPY family_boggle ./family_boggle

# Download NLTK data
RUN python -c "import nltk; nltk.download('words')"

EXPOSE 8000

CMD ["uvicorn", "family_boggle.main:app", "--host", "0.0.0.0", "--port", "8000"]

