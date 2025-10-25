# Backend Server Setup Guide

## Overview
The backend server acts as a secure proxy between your frontend and LLM APIs, keeping your API keys safe from users.

## Quick Start

### 1. Install Dependencies
```bash
pip install flask flask-cors openai anthropic requests
```

### 2. Set Your API Key
Choose one of the following options:

#### Option A: OpenAI GPT (Recommended)
```bash
# Windows PowerShell
$env:OPENAI_API_KEY="sk-proj-your-key-here"

# Or permanently set in PowerShell profile
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-proj-your-key-here', 'User')
```

#### Option B: Anthropic Claude
```bash
# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Or permanently set in PowerShell profile
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-your-key-here', 'User')
```

#### Option C: Local LLM with Ollama (FREE!)
1. Download Ollama from https://ollama.ai
2. Install and run:
```bash
ollama pull llama3.1
ollama serve
```
No API key needed!

### 3. Start the Backend Server
```bash
python backend_server.py
```

You should see:
```
Starting MedCity AI Backend Server...
API endpoint: http://localhost:5000/MedCityAI/query_pubmed
 * Running on http://127.0.0.1:5000
```

### 4. Open Your Website
Open `index.html` in your browser and click any article. The AI summary will generate automatically!

## How It Works

```
User Browser              Your Flask Server          LLM API
    |                           |                       |
    | 1. Click article          |                       |
    |-------------------------->|                       |
    |                           | 2. Call LLM           |
    |                           | (with your API key)   |
    |                           |---------------------->|
    |                           |                       |
    |                           | 3. Summary response   |
    |                           |<----------------------|
    | 4. Display summary        |                       |
    |<--------------------------|                       |
```

**Your API key NEVER leaves the server!**

## Troubleshooting

### "Unable to generate summary"
- Make sure backend server is running (`python backend_server.py`)
- Check that API key is set correctly
- Look for errors in the terminal where server is running

### "Connection refused"
- Backend server must be running before opening the website
- Server runs on port 5000 by default

### "Rate limit exceeded"
- You've hit your API provider's rate limit
- Consider using Ollama (local LLM) for unlimited free usage
- Or add rate limiting to your backend (see main README)

## Next Steps

### Add Rate Limiting (Prevent Abuse)
```bash
pip install Flask-Limiter
```

Then modify `backend_server.py` to add:
```python
from flask_limiter import Limiter
limiter = Limiter(app=app, key_func=lambda: request.remote_addr)

@app.route('/MedCityAI/query_pubmed', methods=['POST'])
@limiter.limit("10 per minute")
def generate_summary():
    # ... your code
```

### Deploy to Production
To make your site public, deploy the backend to:
- **Heroku**: Free tier available
- **Railway**: Easy deployment
- **DigitalOcean**: $5/month droplet
- **AWS/Azure**: Various options

Keep your API keys as environment variables in your hosting platform!
