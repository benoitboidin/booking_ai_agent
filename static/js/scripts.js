function startRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Your browser does not support speech recognition.');
    return;
  }

  const SpeechRecognition = window.webkitSpeechRecognition || null;
  if (!SpeechRecognition) {
    console.error('SpeechRecognition is not supported in this browser.');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'fr-FR';

  recognition.onstart = function() {
    console.log('Speech recognition started');
    const micButton = document.querySelector('.mic-button');
    if (micButton) {
      micButton.classList.add('blinking');
    }
  };

  let sentenceNumber = 0;
  recognition.onresult = function(event) {
    const transcript = event.results[sentenceNumber][0].transcript;
    sentenceNumber++;
    console.log('You said:', transcript);
    
    displayMessage('You: ' + transcript);
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

async function sendTextToServer(text) {
    try {
      const response = await fetch('/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: text })
      });
  
      const data = await response.json();
      console.log(data.message);
      // console.log('Server response:', data.text);
      // displayMessage('Server: ' + data.text);
      if (data.aiResponse) {
        if (data.reservationDetails) {
          updateBookingDetails(data.reservationDetails);
        } else {
          displayMessage('AI: ' + data.aiResponse);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
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