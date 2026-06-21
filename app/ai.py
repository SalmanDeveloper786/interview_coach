import os
import groq
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = None

def get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is missing.")
        _client = Groq(api_key=api_key)
    return _client

def generate_answer_stream(question: str):
    try:
        client = get_client()
        print("Calling Groq...")
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system", 
                    "content": "You are an expert, Senior-level technical interviewer and coach. Provide detailed, advanced, and insightful answers to the interview questions. Your answers must be purely textual explanations. DO NOT write or output any code blocks, snippets, or code syntax. Provide deep, architectural, and senior-level insights."
                },
                {"role": "user", "content": question}
            ],
            max_tokens=250,
            stream=True,
        )

        for chunk in response:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content
                
    except groq.APIStatusError as e:
        # e.response.json() typically contains the 'error' object
        try:
            error_details = e.response.json().get("error", {})
            friendly_msg = error_details.get("message", str(e))
        except Exception:
            friendly_msg = str(e)
            
        yield f"\n[AI Error: {friendly_msg}]"
    except Exception as e:
        yield f"\n[AI Error: An unexpected error occurred. {str(e)}]"