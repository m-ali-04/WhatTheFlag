from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import random
import datetime
import os
from pymongo import MongoClient

app = Flask(__name__)
CORS(app)

BOT_SERVICE_URL = os.environ.get("BOT_SERVICE_URL", "http://localhost:5002")
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")

# Setup MongoDB
client = MongoClient(MONGO_URI)
db = client['whattheflag']
countries_collection = db['countries']
leaderboard_collection = db['leaderboard']

# In-memory session tracker: maps session_id -> set of used country codes
_sessions = {}


def _get_session(session_id):
    """Return (or create) the set of used codes for a session."""
    if session_id not in _sessions:
        _sessions[session_id] = set()
    return _sessions[session_id]


@app.route('/api/seed', methods=['POST'])
def seed_data():
    """Fetch country data from REST Countries API and store in MongoDB."""
    try:
        response = requests.get('https://restcountries.com/v3.1/all?fields=name,flags,cca3')
        response.raise_for_status()
        data = response.json()

        count = 0
        for country in data:
            code = country.get('cca3')
            name = country.get('name', {}).get('common')
            flag_url = country.get('flags', {}).get('svg') or country.get('flags', {}).get('png')

            # REMOVE ISRAEL FLAG as requested
            if name == "Israel" or code == "ISR":
                continue

            if code and name and flag_url:
                # Upsert into MongoDB
                countries_collection.update_one(
                    {"code": code},
                    {"$set": {
                        "name": name,
                        "flag_url": flag_url
                    }, "$setOnInsert": {
                        "difficulty": 0.5,
                        "seen": 0,
                        "correct": 0
                    }},
                    upsert=True
                )
                count += 1

        return jsonify({"message": f"Seeded {count} countries successfully (Israel excluded)."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/question', methods=['GET'])
def get_question():
    """
    Return a quiz question: 1 flag image + 4 answer choices.
    Accepts optional query param ?session_id=<str> to avoid repeating flags
    within a single game session.
    """
    countries_list = list(countries_collection.find({}, {"_id": 0}))

    if not countries_list:
        return jsonify({"error": "No countries seeded yet."}), 400

    if len(countries_list) < 4:
        return jsonify({"error": "Not enough countries for a quiz."}), 400

    session_id = request.args.get('session_id')
    used_codes = _get_session(session_id) if session_id else set()

    # Filter out already-used countries for this session
    available = [c for c in countries_list if c['code'] not in used_codes]

    # If we've exhausted all countries, reset the session pool
    if len(available) < 4:
        if session_id:
            _sessions[session_id] = set()
        available = countries_list

    # Pick the correct country
    correct_country = random.choice(available)

    # Mark as used
    if session_id:
        _sessions[session_id].add(correct_country['code'])

    # Pick 3 distractors (different from correct)
    distractors_pool = [c for c in countries_list if c['code'] != correct_country['code']]
    distractors = random.sample(distractors_pool, 3)

    options = [correct_country['name']] + [c['name'] for c in distractors]
    random.shuffle(options)

    return jsonify({
        "country_code": correct_country['code'],
        "flag_url": correct_country['flag_url'],
        "options": options,
        "correct_answer": correct_country['name'],
        "difficulty": correct_country.get('difficulty', 0.5)
    })


@app.route('/api/session/reset', methods=['POST'])
def reset_session():
    """Clear the used-flag pool for a given session."""
    data = request.json or {}
    session_id = data.get('session_id')
    if session_id and session_id in _sessions:
        _sessions.pop(session_id)
    return jsonify({"message": "Session reset."}), 200


@app.route('/api/answer', methods=['POST'])
def submit_answer():
    """Record a player answer and update the country's difficulty score in MongoDB."""
    data = request.json
    code = data.get('country_code')
    is_correct = data.get('correct', False)

    country = countries_collection.find_one({"code": code})
    if country:
        seen = country.get('seen', 0) + 1
        correct_count = country.get('correct', 0) + (1 if is_correct else 0)
        
        # Laplace smoothing for difficulty: 1.0 - (correct + 1) / (seen + 2)
        new_difficulty = 1.0 - ((correct_count + 1) / (seen + 2))
        
        countries_collection.update_one(
            {"code": code},
            {"$set": {
                "seen": seen,
                "correct": correct_count,
                "difficulty": new_difficulty
            }}
        )
        return jsonify({"message": "Stats updated", "new_difficulty": new_difficulty})

    return jsonify({"error": "Country not found"}), 404


@app.route('/api/bot_race', methods=['POST'])
def bot_race():
    """Proxy a bot-guess request to the bot-service for a specific country."""
    data = request.json
    code = data.get('country_code')
    level = data.get('bot_level', 'medium')

    country = countries_collection.find_one({"code": code})
    if not country:
        return jsonify({"error": "Country not found"}), 404

    difficulty = country.get('difficulty', 0.5)

    try:
        response = requests.post(f"{BOT_SERVICE_URL}/api/guess", json={
            "difficulty": difficulty,
            "bot_level": level
        })
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        # Fallback if bot is down
        print(f"Bot service error: {e}")
        return jsonify({"correct": False, "time_taken": 5.0}), 503


@app.route('/api/leaderboard', methods=['GET', 'POST'])
def leaderboard():
    if request.method == 'POST':
        data = request.json
        if not data or 'username' not in data or 'score' not in data:
            return jsonify({"error": "Invalid leaderboard data"}), 400
        
        entry = {
            "username": data['username'][:20], # Limit name length
            "score": int(data['score']),
            "mode": data.get('mode', 'unknown'),
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        leaderboard_collection.insert_one(entry)
        
        # Retrieve top 50
        top_scores = list(leaderboard_collection.find({}, {"_id": 0}).sort("score", -1).limit(50))
        return jsonify({"message": "Score saved!", "leaderboard": top_scores}), 201
    
    # GET method
    top_scores = list(leaderboard_collection.find({}, {"_id": 0}).sort("score", -1).limit(50))
    return jsonify(top_scores)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
