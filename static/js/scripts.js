const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5050;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('API Key:', GEMINI_API_KEY); // Log the API key to ensure it's being loaded

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.post('/process', async (req, res) => {
  const text = req.body.text || '';

  if (!text) {
    return res.json({ status: 'error', message: 'No text provided!' });
  }

  console.log('You said:', text);

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: text }]
        }]
      })
    });

    console.log('Gemini API response:', response);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return res.json({ status: 'error', message: 'Error communicating with Gemini', details: errorData });
    }

    const data = await response.json();
    const aiResponse = data.candidates[0].output;
    console.log('AI response:', aiResponse);

    return res.json({ status: 'success', message: 'Voice processed successfully!', text: text, aiResponse: aiResponse });
  } catch (error) {
    console.error('Error communicating with Gemini:', error);
    return res.json({ status: 'error', message: 'Error communicating with Gemini', details: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

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
    
    displayMessage('You: ' + transcript, true);
    sendTextToServer(transcript);
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

function sendTextToServer(text) {
  fetch('/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: text })
  })
  .then(response => response.json())
  .then(data => {
    console.log(data.message);
    // console.log('Server response:', data.text);
    // displayMessage('Server: ' + data.text);
    if (data.aiResponse) {
        if (data.reservationDetails) {
            updateBookingDetails(data.reservationDetails);
        }else{
            displayMessage('AI: ' + data.aiResponse);
        }
    }
  })
  .catch(error => {
    console.error('Error:', error);
  });
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

function updateBookingDetails(details) {
  if (details.date) {
    const dateInput = document.getElementById('booking-date');
    dateInput.value = details.date;
    dateInput.classList.remove('grey');
    dateInput.classList.add('green');
  }

  if (details.heure) {
    const timeInput = document.getElementById('booking-time');
    timeInput.value = details.heure;
    timeInput.classList.remove('grey');
    timeInput.classList.add('green');
  }

  if (details.nombre_personnes) {
    const numberOfClientsInput = document.getElementById('number-of-clients');
    numberOfClientsInput.value = details.nombre_personnes;
    numberOfClientsInput.classList.remove('grey');
    numberOfClientsInput.classList.add('green');
  }

  if (details.nom) {
    const userNameInput = document.getElementById('user-name');
    userNameInput.value = details.nom;
    userNameInput.classList.remove('grey');
    userNameInput.classList.add('green');
  }
}