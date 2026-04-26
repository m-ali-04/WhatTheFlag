from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import math

app = Flask(__name__)
CORS(app)


@app.route('/api/guess', methods=['POST'])
def bot_guess():
    """
    Receives difficulty (0.0-1.0) and bot_level ('easy'|'medium'|'hard').
    Returns whether the bot guessed correctly and how long it simulated thinking.
    """
    data = request.json
    difficulty = float(data.get('difficulty', 0.5))
    level = data.get('bot_level', 'medium')

    # --- Accuracy ---
    level_accuracy = {
        'easy':   0.40,
        'medium': 0.65,
        'hard':   0.88
    }
    base_prob = level_accuracy.get(level, 0.65)

    actual_prob = base_prob * (1.0 - difficulty * 0.45)
    is_correct = random.random() < actual_prob

    # --- Timing ---
    speed_scale = {
        'easy':   8.0,
        'medium': 5.5,
        'hard':   3.5
    }
    base_time = {
        'easy':   1.2,
        'medium': 0.6,
        'hard':   0.3
    }

    scale = speed_scale.get(level, 5.5)
    base = base_time.get(level, 0.6)

    time_taken = base + (difficulty ** 1.8) * scale + random.uniform(-0.3, 1.0)
    time_taken = max(0.3, round(time_taken, 2))

    return jsonify({
        "correct": is_correct,
        "time_taken": time_taken
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
