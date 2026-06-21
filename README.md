# Interview Coach AI

Interview Coach AI is a responsive, real-time web application designed to act as an expert, senior-level technical interviewer. It captures spoken questions via the browser's native Web Speech API and instantly streams deep, architectural AI responses back using the Groq LLM API.

## Features
- **Voice-to-Text:** Continuous, real-time transcription directly in the browser.
- **Low-Latency AI:** Token-by-token response streaming using the ultra-fast Groq API (`llama-3.1-8b-instant`).
- **Modern UI:** Sleek, mobile-responsive dark theme with glassmorphism and a visual audio meter.
- **Secure:** Cookie-based session authentication for application access.

## Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
- [k6](https://k6.io/docs/getting-started/installation/) (Optional, if you want to run the included load tests)

## Getting Started

1. **Configure Environment Variables**  
   Create a `.env` file in the root directory with the following keys:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=supersecret
   SESSION_SECRET=change_this_to_a_secure_random_string
   ```

2. **Run the Application**  
   Use Docker Compose to build and start the container:
   ```bash
   docker compose up --build
   ```
   Once running, access the web UI at [http://localhost:8000](http://localhost:8000).

## Load Testing
The repository contains `k6` scripts to stress test the backend endpoints (specifically the `GET /health` route).

- **Basic Health Test:** Checks if the health endpoint returns a 200 OK.
  ```bash
  k6 run health_test.js
  ```
- **Ramp Test:** Gradually increases concurrent users to test stability under load.
  ```bash
  k6 run ramp_test.js
  ```

## Documentation
For a comprehensive breakdown of the application architecture and technology stack, please refer to the [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) file.
