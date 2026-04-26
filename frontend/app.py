from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

# Fallback to local game engine if not running via Docker
ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:5001/api")

@app.route('/')
def index():
    return render_template('index.html')

# Proxy route to the Game Engine
@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy(path):
    url = f"{ENGINE_URL}/{path}"
    
    # Forward the query params
    params = request.args
    
    # Forward the JSON body if any
    json_data = request.json if request.is_json else None
    
    try:
        if request.method == 'GET':
            resp = requests.get(url, params=params)
        elif request.method == 'POST':
            resp = requests.post(url, json=json_data, params=params)
        elif request.method == 'PUT':
            resp = requests.put(url, json=json_data, params=params)
        elif request.method == 'DELETE':
            resp = requests.delete(url, json=json_data, params=params)
            
        return (resp.content, resp.status_code, resp.headers.items())
    except Exception as e:
        print(f"Proxy error: {e}")
        return jsonify({"error": "Failed to connect to Game Engine"}), 502

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
