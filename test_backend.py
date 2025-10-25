"""
Quick test script to verify backend server is working
Run this AFTER starting backend_server.py in another terminal
"""
import requests
import json

# Test data
test_request = {
    "pmid": "12345678",
    "title": "A Revolutionary Study on Medical AI",
    "abstract": "This groundbreaking research demonstrates how artificial intelligence can improve diagnostic accuracy in radiology. Researchers analyzed 10,000 chest X-rays and found that AI-assisted diagnosis increased accuracy by 15% compared to traditional methods. The study involved three major hospitals and showed promising results for real-world clinical application."
}

print("Testing backend server...")
print("=" * 50)

try:
    response = requests.post(
        'http://localhost:5000/MedCityAI/query_pubmed',
        headers={'Content-Type': 'application/json'},
        json=test_request,
        timeout=30
    )
    
    if response.status_code == 200:
        result = response.json()
        print("✅ SUCCESS! Backend server is working!")
        print("\nGenerated Summary:")
        print("-" * 50)
        print(result.get('summary', 'No summary returned'))
        print("-" * 50)
        print("\nYour LLM integration is ready to use!")
    else:
        print(f"❌ Error: Server returned status code {response.status_code}")
        print(f"Response: {response.text}")
        
except requests.exceptions.ConnectionError:
    print("❌ ERROR: Cannot connect to backend server")
    print("\nMake sure backend_server.py is running:")
    print("  python backend_server.py")
    print("\nIt should be running on http://localhost:5000")
    
except requests.exceptions.Timeout:
    print("⏱️  Request timed out (LLM might be slow)")
    print("This could mean:")
    print("  - LLM API is responding slowly")
    print("  - API key not configured")
    print("  - Check terminal running backend_server.py for errors")
    
except Exception as e:
    print(f"❌ Unexpected error: {e}")

print("\n" + "=" * 50)
