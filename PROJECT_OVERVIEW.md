# Interview Coach AI

## Project Overview
Interview Coach AI is a responsive, real-time web application designed to act as an expert, senior-level technical interviewer. It listens to spoken interview questions using your device's microphone, processes the transcribed text using a low-latency LLM, and instantly streams back deep, architectural, and insightful coaching answers without writing code snippets. 

The application utilizes native browser APIs for continuous voice recognition and raw audio processing, ensuring highly sensitive microphone capture (even from external device speakers). The UI is built with a sleek, glassmorphic dark theme tailored for high scannability and seamless mobile responsiveness.

## Project Stack

### Backend
* **Python 3.12+**
* **FastAPI:** High-performance asynchronous web framework for serving the UI and API endpoints.
* **Uvicorn:** ASGI web server implementation.
* **itsdangerous:** Secure, signed cookie-based session management for authentication.
* **Groq Python SDK:** For extremely low-latency inference using Llama 3 models.
* **Jinja2:** Template engine for server-side HTML rendering.

### Frontend
* **HTML5:** Semantic structuring with integrated Jinja2 templating.
* **CSS3 (Vanilla):** Custom, mobile-first responsive design featuring CSS grid/flexbox, backdrop-filter (glassmorphism), micro-animations, and modern typography (Google Fonts: Outfit & Inter).
* **JavaScript (Vanilla):** 
  * **Web Speech API (`webkitSpeechRecognition`):** For continuous, real-time voice-to-text transcription.
  * **Web Audio API (`AnalyserNode`):** For real-time, visual volume meter rendering.
  * **Fetch API / ReadableStream:** For consuming Server-Sent Events (SSE) and rendering the LLM's response token-by-token.
* **Lucide Icons:** Clean, lightweight SVG iconography.

### AI Engine
* **Provider:** Groq
* **Model:** `llama-3.1-8b-instant`
* **Configuration:** System prompt tuned for senior-level technical discourse, restricted to purely textual explanations (no code generation), with full chunk streaming enabled for a typewriter-style UI effect.

### Infrastructure & Deployment
* **Docker:** Containerized application environment (`Dockerfile`).
* **Docker Compose:** Multi-container orchestration (`docker-compose.yml`) for local development and rapid environment spin-ups.
* **Environment Management:** `python-dotenv` for local `.env` secret management.
