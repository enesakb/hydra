version: '3.8'

services:
  # Agent Alpha — Aggressive Trader
  agent-alpha:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: hydra-alpha
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AGENT_PRESET=aggressive
      - AGENT_NAME=Alpha
    volumes:
      - alpha-data:/root/.hydra
    ports:
      - "3001:3000"
    restart: unless-stopped

  # Agent Beta — Conservative Diversifier
  agent-beta:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: hydra-beta
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AGENT_PRESET=conservative
      - AGENT_NAME=Beta
    volumes:
      - beta-data:/root/.hydra
    ports:
      - "3002:3000"
    restart: unless-stopped

  # Agent Gamma — Random DNA (Evolution Experiment)
  agent-gamma:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: hydra-gamma
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AGENT_PRESET=random
      - AGENT_NAME=Gamma
    volumes:
      - gamma-data:/root/.hydra
    ports:
      - "3003:3000"
    restart: unless-stopped

  # Ollama — Local model fallback
  ollama:
    image: ollama/ollama:latest
    container_name: hydra-ollama
    volumes:
      - ollama-models:/root/.ollama
    ports:
      - "11434:11434"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  alpha-data:
  beta-data:
  gamma-data:
  ollama-models:
