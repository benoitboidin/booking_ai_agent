let listening = false;
let recognition = null; // Store recognition instance

window.scrollTo(0,1); // Hide the address bar on mobile devices

function startRecognition() {

  if (!('webkitSpeechRecognition' in window)) {
    alert('Your browser does not support speech recognition.');
    return;
  }

var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error('SpeechRecognition is not supported in this browser.');
    const micButton = document.querySelector('.mic-button');
    if (micButton) {
      micButton.classList.remove('blinking');
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false; // true doesn't work on Android devices.
  recognition.interimResults = false;
  recognition.lang = 'fr-FR';

  let welcomeMessage = 'Bienvenue au Café Paris, puis-je prendre votre réservation?';
  displayMessage(welcomeMessage, false);
  speakText(welcomeMessage);

  recognition.onstart = function() {
    console.log('Speech recognition started');
  };

  let sentenceNumber = 0;
  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    console.log(sentenceNumber, 'Transcript:', transcript);
    sentenceNumber++;
    displayMessage(transcript, true);
    sendTextToServer(new Date().toLocaleTimeString('fr-FR'), transcript);
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
        }else{
            listening = false;
            micButton.classList.remove('blinking');
            recognition.stop();
            // stop speech synthesis
            speechSynthesis.cancel();
        }
      }
    );
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
      if (data.aiResponse) {
        if (data.reservationDetails) {
          updateBookingDetails(data.reservationDetails);
          displayMessage('Réservation enregistrée. Merci et à bientôt!', false);
          speakText('Réservation enregistrée. Merci et à bientôt!');
        } else {
          displayMessage(data.aiResponse, false);
          speakText(data.aiResponse);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
}

function displayMessage(message, user=true) {
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

function updateBookingDetails(details) {
  console.log('Updating booking details:', details);

  if (details.date) {
    const dateSpan = document.getElementById('booking-date');
    dateSpan.textContent = details.date;
    dateSpan.style.display = 'inline';
    dateSpan.classList.remove('empty');
    dateSpan.classList.add('filled');
  }

  if (details.heure) {
    const timeSpan = document.getElementById('booking-time');
    timeSpan.textContent = details.heure;
    timeSpan.style.display = 'inline';
    timeSpan.classList.remove('empty');
    timeSpan.classList.add('filled');
  }

  if (details.nombre_personnes) {
    const numberOfClientsSpan = document.getElementById('number-of-clients');
    numberOfClientsSpan.textContent = details.nombre_personnes + ' personnes';
    numberOfClientsSpan.style.display = 'inline';
    numberOfClientsSpan.classList.remove('empty');
    numberOfClientsSpan.classList.add('filled');
  }

  if (details.nom) {
    const userNameSpan = document.getElementById('user-name');
    userNameSpan.textContent = details.nom;
    userNameSpan.style.display = 'inline';
    userNameSpan.classList.remove('empty');
    userNameSpan.classList.add('filled');
  }

  // If every detail is filled, stop listening
  if (details.date && details.heure && details.nombre_personnes && details.nom) {
    listening = false;
    const micButton = document.querySelector('.mic-button');
    if (micButton) {
      recognition.stop();
      micButton.classList.remove('blinking');
    }
  }
}

