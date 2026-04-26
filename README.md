# WhatTheFlag 🚩

WhatTheFlag is a flag guessing game built with Python (Flask) and MongoDB, containerized with Docker.

## Project Structure

- `frontend/`: Flask application serving the web interface.
- `game-engine/`: Core logic and API for game management.
- `bot-service/`: Placeholder/Service for bot interactions.
- `docker-compose.yml`: Orchestrates the services and MongoDB database.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Local Development / Deployment

To start the entire application, run:

```bash
docker-compose up --build -d
```

The application will be available at:
- Frontend: [http://localhost:5000](http://localhost:5000)
- Game Engine API: [http://localhost:5001](http://localhost:5001)

## EC2 Deployment Guide

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd WhatTheFlag
   ```

2. **Install Docker and Docker Compose** (if not already installed):
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose -y
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

3. **Run the application**:
   ```bash
   docker-compose up --build -d
   ```

4. **Security Group Configuration**:
   Ensure your EC2 instance allows inbound traffic on port `5000`.
