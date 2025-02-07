let listening = false;
let recognition = null; // Store recognition instance

function speakText(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR'; // Set language to French
      utterance.rate = 1.1; // Adjust speed (1 is normal)
      utterance.pitch = 0.9; // Adjust pitch (1 is normal)
      speechSynthesis.speak(utterance);
    } else {
      console.error('Speech synthesis is not supported in this browser.');
    }
  }

  function startRecognition() {

  if (!('webkitSpeechRecognition' in window)) {
    alert('Your browser does not support speech recognition.');
    return;
  }

  if (recognition && listening) {
    // Stop recognition if it's already running
    recognition.stop();
    listening = false;
    console.log('Speech recognition stopped');
    document.querySelector('.mic-button').classList.remove('blinking');
    return;
  }

var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error('SpeechRecognition is not supported in this browser.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'fr-FR';

  recognition.onstart = function() {
    listening = true;
    console.log('Speech recognition started');
    document.querySelector('.mic-button').classList.add('blinking');
  };

  let sentenceNumber = 0;
  recognition.onresult = function(event) {
    const transcript = event.results[sentenceNumber][0].transcript;
    sentenceNumber++;
    displayMessage('You: ' + transcript);
    sendTextToServer(transcript);
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error', event);
  };

  recognition.onend = function() {
    console.log('Speech recognition ended');
    listening = false;
    document.querySelector('.mic-button').classList.remove('blinking');
  };

  recognition.start();
}

function addEventListeners() {
  const micButton = document.querySelector('.mic-button');
  if (micButton) {
    console.log('Adding event listener to mic button');
    micButton.addEventListener('click', startRecognition);
  }
}

document.addEventListener('DOMContentLoaded', addEventListeners);


async function sendTextToServer(text) {
    console.log('Sending text to server:', text);
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
            displayMessage('AI: Réservation enregistrée. Merci et à bientôt!');
            speakText('Réservation enregistrée. Merci et à bientôt!');
            // Toggle button to stop listening
            startRecognition();
        } else {
          displayMessage('AI: ' + data.aiResponse);
            speakText(data.aiResponse);
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
  console.log('Updating booking details:', details);

  if (details.date) {
    const dateSpan = document.getElementById('booking-date');
    dateSpan.textContent = details.date;
    dateSpan.style.display = 'inline';
    dateSpan.classList.add('filled');
  }

  if (details.heure) {
    const timeSpan = document.getElementById('booking-time');
    timeSpan.textContent = details.heure;
    timeSpan.style.display = 'inline';
    timeSpan.classList.add('filled');
  }

  if (details.nombre_personnes) {
    const numberOfClientsSpan = document.getElementById('number-of-clients');
    numberOfClientsSpan.textContent = details.nombre_personnes + ' personnes';
    numberOfClientsSpan.style.display = 'inline';
    numberOfClientsSpan.classList.add('filled');
  }

  if (details.nom) {
    const userNameSpan = document.getElementById('user-name');
    userNameSpan.textContent = details.nom;
    userNameSpan.style.display = 'inline';
    userNameSpan.classList.add('filled');
  }
}
