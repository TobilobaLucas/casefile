FROM python:3.13-slim
WORKDIR /app
RUN useradd --create-home casefile
COPY case_engine.py server.py ./
USER casefile
ENV HOST=0.0.0.0 PORT=8001 PYTHONUNBUFFERED=1
EXPOSE 8001
CMD ["python", "server.py"]
