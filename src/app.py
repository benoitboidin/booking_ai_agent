from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Required for session management

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process_voice():
    data = request.get_json()
    text = data.get('text', '')
    
    if not text:
        return jsonify({"status": "error", "message": "No text provided!"})
    
    print("You said:", text)
    return jsonify({"status": "success", "message": "Voice processed successfully!", "text": text})

if __name__ == '__main__':
    app.run(debug=True)