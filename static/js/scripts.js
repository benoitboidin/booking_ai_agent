let listening = false;
let recognition = null; // Store recognition instance
let conversationHistory = []; // Store conversation history for each user
let _speechSynth;
let _voices;
const _cache = {};
let hasEnabledVoice = false;

// Load voices when available
function loadVoicesWhenAvailable(onComplete = () => {}) {
  _speechSynth = window.speechSynthesis;
  const voices = _speechSynth.getVoices();

  if (voices.length !== 0) {
    _voices = voices;
    onComplete();
  } else {
    return setTimeout(function () { loadVoicesWhenAvailable(onComplete); }, 100);
  }
}

// Get voices for a given locale
function getVoices(locale) {
  if (!_speechSynth) {
    throw new Error('Browser does not support speech synthesis');
  }
  if (_cache[locale]) return _cache[locale];

  _cache[locale] = _voices.filter(voice => voice.lang === locale);
  return _cache[locale];
}

// Speak a certain text
function playByText(locale, text, onEnd) {
  const voices = getVoices(locale);

  const utterance = new window.SpeechSynthesisUtterance();
  utterance.voice = voices[2];
  utterance.pitch = 1.2;
  utterance.rate = 1.1;
  utterance.voiceURI = 'native';
  utterance.volume = 1;
  utterance.text = text;
  utterance.lang = locale;

  if (onEnd) {
    utterance.onend = onEnd;
  }

  _speechSynth.cancel(); // cancel current speak, if any is running
    _speechSynth.speak(utterance);
}

// Initialize voices on document ready
document.addEventListener('DOMContentLoaded', () => {
  loadVoicesWhenAvailable(() => {
    console.log("Voices loaded");
  });
  addEventListeners();
  fetchSystemPrompt();
});

// Enable speech synthesis on user interaction
document.addEventListener('click', () => {
  if (hasEnabledVoice) {
    return;
  }
  const lecture = new SpeechSynthesisUtterance('hello');
  lecture.volume = 0;
  speechSynthesis.speak(lecture);
  hasEnabledVoice = true;
});

async function fetchSystemPrompt() {
  try {
    const response = await fetch('/system-prompt');
    const data = await response.json();
    
    const prompt = data.prompt;
    let date = new Date().toLocaleDateString('fr-FR');
    let heure = new Date().toLocaleTimeString('fr-FR');
    let systemPrompt = `Nous sommes le ${date} et il est ${heure}. ${prompt}`;
    
    console.log('System prompt:', systemPrompt);
    
    conversationHistory.push({ role: 'user', parts: [{ text: `System: ${systemPrompt}` }] });
    conversationHistory.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  } catch (error) {
    console.error('Error fetching system prompt:', error);
  }
}

function startRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Your browser does not support speech recognition.');
    return;
  }

  var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error('SpeechRecognition is not supported in this browser.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false; // true doesn't work on Android devices.
  recognition.interimResults = false;
  recognition.lang = 'fr-FR';

  recognition.onstart = function() {
    console.log('Speech recognition started');
  };

  let sentenceNumber = 0;
  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    console.log(sentenceNumber, 'Transcript:', transcript);
    sentenceNumber++;
    displayMessage(transcript, true);
    conversationHistory.push({ role: 'user', parts: [{ text: transcript }] });
    sendTextToServer(transcript);
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error', event);
  };

  recognition.onend = function() {
    console.log('Speech recognition ended');
    if (listening) {
      console.log('Restarting speech recognition (until mic button is clicked)');
      recognition.start();
    }
  };

  recognition.start();
}

function addEventListeners() {
  const micButton = document.querySelector('.mic-button');
  if (micButton) {
    console.log('Adding event listener to mic button');
    micButton.addEventListener('click', function() {
      console.log('Mic button clicked');
      if (!listening) {
        listening = true;
        micButton.classList.add('blinking');
        startRecognition();
      } else {
        listening = false;
        micButton.classList.remove('blinking');
        recognition.stop();
        speechSynthesis.cancel();
      }
    });
  }
}

async function sendTextToServer(text) {
  console.log('Sending text to server:', text);
  try {
    const response = await fetch('/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text, conversationHistory: conversationHistory })
    });

    const data = await response.json();
    console.log(data.message);
    if (data.aiResponse) {
      conversationHistory.push({ role: 'model', parts: [{ text: data.aiResponse }] });
      if (data.reservationDetails) {
        recognition.stop(); 
        listening = false;  
        updateBookingDetails(data.reservationDetails);
        displayMessage('Réservation enregistrée. Merci et à bientôt!', false);
        playByText('fr-FR', 'Réservation enregistrée. Merci et à bientôt!');
        const micButton = document.querySelector('.mic-button');
        if (micButton) {
          micButton.classList.remove('blinking');
        }
      } else {
        displayMessage(data.aiResponse, false);
        playByText('fr-FR', data.aiResponse, startRecognition);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayMessage(message, user = true) {
  const chatBox = document.getElementById('chat-box');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  if (user) {
    messageDiv.classList.add('user');
  } else {
    messageDiv.classList.add('ai');
  }
  messageDiv.textContent = message;
  if (chatBox) {
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    console.error('Chat box element not found');
  }
}

function updateField(fieldId, value, suffix = '') {
  const element = document.getElementById(fieldId);
  element.textContent = value + suffix;
  element.style.display = 'inline';
  element.classList.remove('empty');
  element.classList.add('filled');
}

function updateBookingDetails(details) {
  console.log('Updating booking details:', details);
  if (details.date) updateField('booking-date', details.date);
  if (details.heure) updateField('booking-time', details.heure);
  if (details.nombre_personnes) updateField('number-of-clients', details.nombre_personnes, ' personnes');
  if (details.nom) updateField('user-name', details.nom);
}


