function startRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Your browser does not support speech recognition. Please use Google Chrome.');
    return;
  }

  const SpeechRecognition = window.webkitSpeechRecognition || null;
  if (!SpeechRecognition) {
    console.error('SpeechRecognition is not supported in this browser.');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'fr-FR';

  recognition.onstart = function() {
    console.log('Speech recognition started');
    const micButton = document.querySelector('.mic-button');
    if (micButton) {
      micButton.classList.add('blinking');
    }
  };

  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    console.log('You said:', transcript);
    
    displayMessage('You: ' + transcript);
    sendTextToOllama(transcript);
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error', event);
  };

  recognition.onend = function() {
    console.log('Speech recognition ended');
    const micButton = document.querySelector('.mic-button');
    if (micButton) {
      micButton.classList.remove('blinking');
    }
  };

  recognition.start();
}

function sendTextToOllama(text) {
    fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3.2-vision:latest',  // Replace with your Ollama model name
        prompt: text,
        stream: false
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Ollama response:', data.response);
      displayMessage('Ollama: ' + data.response);
    })
    .catch(error => console.error('Error fetching from Ollama:', error));
  }
  

function displayMessage(message) {
  const chatBox = document.getElementById('chat-box');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  messageDiv.textContent = message;
  if (chatBox) {
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    console.error('Chat box element not found');
  }
}