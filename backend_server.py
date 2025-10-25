from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os
from anthropic import Anthropic

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Configure your AI service (choose one)
# Option 1: OpenAI
# openai.api_key = os.getenv("OPENAI_API_KEY")

# Option 2: Anthropic Claude
# anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

@app.route('/MedCityAI/query_pubmed', methods=['POST'])
def generate_summary():
    try:
        data = request.json
        pmid = data.get('pmid')
        title = data.get('title')
        abstract = data.get('abstract')
        
        if not abstract:
            return jsonify({'error': 'No abstract provided'}), 400
        
        # Generate summary using your preferred LLM
        summary = generate_llm_summary(title, abstract)
        
        return jsonify({'summary': summary})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


def generate_llm_summary(title, abstract):
    """
    Generate a common language summary using an LLM.
    Choose your preferred method below.
    """
    
    prompt = f"""You are a medical communication expert. Create a common language summary of this research article that anyone can understand.

Title: {title}

Abstract: {abstract}

Write a 5-sentence summary in plain English that explains:
1. What the researchers studied
2. How they did it
3. What they found (main results)
4. Why it matters
5. What it means for patients/healthcare

Use simple language, avoid jargon, and focus on the most important information."""

    # OPTION 1: OpenAI GPT
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a medical communication expert who explains research in simple terms."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )
        return response.choices[0].message.content
    except:
        pass
    
    # OPTION 2: Anthropic Claude
    try:
        anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        message = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=300,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text
    except:
        pass
    
    # OPTION 3: Local LLM (Ollama)
    try:
        import requests
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                'model': 'llama2',
                'prompt': prompt,
                'stream': False
            }
        )
        return response.json()['response']
    except:
        pass
    
    # Fallback if no LLM is configured
    return "AI summary service not configured. Please set up OpenAI, Anthropic, or Ollama."


if __name__ == '__main__':
    print("Starting MedCity AI Backend Server...")
    print("API endpoint: http://localhost:5000/MedCityAI/query_pubmed")
    print("Make sure to set your API key as an environment variable:")
    print("  - OPENAI_API_KEY for OpenAI")
    print("  - ANTHROPIC_API_KEY for Anthropic Claude")
    print("  - Or run Ollama locally on port 11434")
    app.run(debug=True, port=5000)
