# 🚨 AapdaNetra (आपदा-नेत्र)
**Smart India Hackathon 2026** - Problem Statement ID: 26206

AapdaNetra is a Next-Generation, AI-Powered Disaster Intelligence & Response Platform designed to bridge the critical gap between citizens in distress and rescue authorities (NDRF/SDRF).

## 🌍 Live Demo
* **Live Application:** [https://aapda-netra-sih.vercel.app](https://aapda-netra-sih.vercel.app)

---

## ⚡ Key Features
- **Made in India Mapping:** Fully integrated with **Ola Maps API** for local, secure, and accurate geographical rendering.
- **AI Emergency Chatbot (AapdaGPT):** Powered by Google Gemini AI to provide real-time, multilingual safety guidelines to panicked citizens.
- **Dynamic Breathing Heatmaps:** Automatically clusters disaster reports using Haversine formulas and renders real-time priority-based pulsing markers.
- **Command Center Dashboard:** A futuristic dark-theme interface for authorities to monitor severe zones with live Recharts analytics.
- **1-Click Dispatch & Broadcast:** Authorities can assign rescue units (NDRF/SDRF) to specific incidents and simulate broadcasting Public Emergency SMS Alerts in a 5km radius.
- **Secure Role-Based Auth:** Master-Key protected Command Center registration to prevent unauthorized access.

---

## 🛠️ Tech Stack
* **Frontend:** React 18, Vite, TailwindCSS, React-Leaflet, Lucide-React, Recharts
* **Backend:** Python, FastAPI, SQLAlchemy, Pydantic, Passlib (Bcrypt)
* **Database:** PostgreSQL (Hosted on Render)
* **AI & APIs:** Google Gemini 1.5 Flash SDK, Ola Maps Vector API
* **Deployment:** Vercel (Frontend), Render (Backend & DB)

---

## 🚀 Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-username/AapdaNetra-SIH.git
cd AapdaNetra-SIH
```

### 2. Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # For Windows
# source venv/bin/activate # For Mac/Linux

pip install -r requirements.txt
uvicorn app.main:app --reload
```
*Backend will run at `http://localhost:8000`*

### 3. Frontend Setup (React/Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend will run at `http://localhost:5173`*

---
*Built with ❤️ for Smart India Hackathon 2026*
