# 🚀 LLM Integration - Complete Setup

Your MedCity AI website now has **live LLM-powered summaries** using the backend proxy pattern!

## ✅ What's Been Added

### 1. **Secure Backend Proxy** (`backend_server.py`)
   - Flask server that keeps your API keys safe
   - Supports OpenAI GPT, Anthropic Claude, or local Ollama
   - Users can never see your API keys

### 2. **Frontend Integration** (`index.html`)
   - When users click an article, it automatically generates an AI summary
   - Beautiful loading animation while processing
   - Error handling if backend is unavailable

### 3. **Visual Design**
   - AI Summary appears in a gradient box below the abstract
   - 🤖 Robot emoji to indicate AI-generated content
   - Matches your site's color scheme (#e74c3c orange accent)

## 🎯 Quick Start (3 Steps)

### Step 1: Choose Your LLM

**Option A: OpenAI (Best Quality)**
```powershell
$env:OPENAI_API_KEY="sk-proj-your-actual-key-here"
```
Get key from: https://platform.openai.com/api-keys

**Option B: Anthropic Claude (Good Alternative)**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-your-actual-key-here"
```
Get key from: https://console.anthropic.com/

**Option C: Ollama (FREE, Local, No API Key!)**
```powershell
# Download from https://ollama.ai, then:
ollama pull llama3.1
ollama serve
```

### Step 2: Start Backend Server
```powershell
python backend_server.py
```
Keep this terminal open! You should see:
```
Starting MedCity AI Backend Server...
API endpoint: http://localhost:5000/MedCityAI/query_pubmed
```

### Step 3: Test It!
Open `index.html` in your browser, search for an article, click it → AI summary appears! 🎉

## 🧪 Testing

Run the test script to verify everything works:
```powershell
python test_backend.py
```

This will test the backend and show you a sample AI summary.

## 🎨 How It Looks

```
┌─────────────────────────────────────────┐
│ Article Title                           │
│ Authors: Smith J, Johnson K             │
│                                         │
│ Abstract                                │
│ The full abstract text appears here... │
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 🤖 AI Summary                       ││
│ │ [Generating plain-language summary] ││ ← Loading
│ └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

Then after ~3 seconds:
```
┌─────────────────────────────────────────┐
│ 🤖 AI Summary                           │
│ ┌─────────────────────────────────────┐│
│ │ This study looked at how AI can     ││
│ │ help doctors read X-rays. They      ││
│ │ found it made diagnosis 15% more    ││
│ │ accurate. This could help patients  ││
│ │ get better care faster.             ││
│ └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## 🔧 Architecture

```
┌─────────────┐          ┌──────────────┐         ┌──────────┐
│   Browser   │          │ Flask Server │         │ OpenAI/  │
│             │          │ :5000        │         │ Claude/  │
│ index.html  │─────────▶│              │────────▶│ Ollama   │
│             │ POST     │ API Key ✓    │ POST    │          │
│             │◀─────────│              │◀────────│          │
│ (no keys!)  │ Summary  │ backend_     │ Summary │ (LLM)    │
└─────────────┘          │ server.py    │         └──────────┘
                         └──────────────┘
```

**Security**: API keys are stored only on your server as environment variables, never exposed to users!

## 📝 Code Changes Made

### `index.html`
- Added CSS for `.llm-summary` with gradient background
- Added `generateLLMSummary()` function to call backend
- Modified `showAbstractModal()` to trigger LLM generation
- Loading animation with animated dots

### `backend_server.py`
- Already configured with 3 LLM options
- Endpoint: `/MedCityAI/query_pubmed`
- Returns plain-language 5-sentence summaries

## 🚨 Troubleshooting

### "Unable to generate summary"
✅ Start backend server: `python backend_server.py`
✅ Check API key is set: `echo $env:OPENAI_API_KEY`
✅ Look for errors in backend terminal

### "Connection refused"
✅ Backend must be running before opening website
✅ Check backend is on port 5000

### Slow summaries
✅ Normal! LLMs take 2-10 seconds
✅ Consider caching for repeated articles
✅ Ollama might be slower on CPU (use GPU for speed)

## 🎯 Next Steps

### 1. **Add Caching** (Avoid re-generating same summaries)
```python
from functools import lru_cache

@lru_cache(maxsize=500)
def generate_llm_summary_cached(pmid, title, abstract):
    return generate_llm_summary(title, abstract)
```

### 2. **Add Rate Limiting** (Prevent abuse)
```bash
pip install Flask-Limiter
```

### 3. **Deploy to Production**
- Deploy backend to Heroku/Railway/DigitalOcean
- Update frontend to call your production URL
- Set API keys as environment variables in hosting

## 💡 Tips

- **Ollama is FREE** - No API costs, runs locally
- **OpenAI GPT-4** gives best quality summaries
- **Claude** is great alternative to OpenAI
- Backend can run on same machine or separate server
- Cache summaries to save API costs
- Add rate limiting before deploying publicly

## 📚 Additional Resources

- OpenAI API Docs: https://platform.openai.com/docs
- Anthropic API Docs: https://docs.anthropic.com
- Ollama Download: https://ollama.ai
- Flask Documentation: https://flask.palletsprojects.com

---

**Your LLM integration is ready!** Start the backend server and test it out! 🎉
