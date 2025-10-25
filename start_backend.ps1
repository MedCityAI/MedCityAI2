# MedCity AI - Backend Server Startup Script
# This script helps you start the backend server with your API key

Write-Host "🚀 MedCity AI - Starting Backend Server" -ForegroundColor Cyan
Write-Host "=" * 50

# Check if API key is set
$hasOpenAI = $env:OPENAI_API_KEY -ne $null -and $env:OPENAI_API_KEY -ne ""
$hasAnthropic = $env:ANTHROPIC_API_KEY -ne $null -and $env:ANTHROPIC_API_KEY -ne ""

if (-not $hasOpenAI -and -not $hasAnthropic) {
    Write-Host ""
    Write-Host "⚠️  No API key detected!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please choose an option:" -ForegroundColor White
    Write-Host ""
    Write-Host "1. Set OpenAI API Key (Recommended)" -ForegroundColor Green
    Write-Host "   `$env:OPENAI_API_KEY='sk-proj-your-key-here'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Set Anthropic API Key" -ForegroundColor Green
    Write-Host "   `$env:ANTHROPIC_API_KEY='sk-ant-your-key-here'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Use Ollama (FREE, Local)" -ForegroundColor Green
    Write-Host "   Download from: https://ollama.ai" -ForegroundColor Gray
    Write-Host "   Then run: ollama pull llama3.1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "=" * 50
    Write-Host ""
    
    $choice = Read-Host "Enter your choice (1-3) or press Enter to continue anyway"
    
    if ($choice -eq "1") {
        $key = Read-Host "Enter your OpenAI API key"
        $env:OPENAI_API_KEY = $key
        Write-Host "✅ OpenAI API key set for this session" -ForegroundColor Green
    }
    elseif ($choice -eq "2") {
        $key = Read-Host "Enter your Anthropic API key"
        $env:ANTHROPIC_API_KEY = $key
        Write-Host "✅ Anthropic API key set for this session" -ForegroundColor Green
    }
    elseif ($choice -eq "3") {
        Write-Host "ℹ️  Make sure Ollama is running: ollama serve" -ForegroundColor Cyan
    }
    Write-Host ""
}
else {
    if ($hasOpenAI) {
        Write-Host "✅ OpenAI API key detected" -ForegroundColor Green
    }
    if ($hasAnthropic) {
        Write-Host "✅ Anthropic API key detected" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Starting Flask backend server..." -ForegroundColor Cyan
Write-Host "Server will run at: http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "=" * 50
Write-Host ""

# Start the server
python backend_server.py
