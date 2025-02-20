const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5050;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'static')));

// API specific functions

function convertToGeminiFormat(conversationHistory) {   
        // Define the pattern to match the roles and their corresponding text
        const pattern = /(model|user): (.*)/i;

        // Split the text into lines
        const lines = conversationHistory.split('\n');
    
        // Initialize the structured content as an array
        const structuredContent = [];
    
        // Iterate over each line and match the pattern
        lines.forEach(line => {
            const match = line.match(pattern);
            if (match) {
                const role = match[1].toLowerCase();
                const content = match[2];
                structuredContent.push({
                    role: role,
                    parts: [{ text: content }]
                });
            }
        });
    
        return structuredContent;
    }

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/system-prompt', (req, res) => {
  fs.readFile('config/system_prompt.txt', 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading system prompt:', err);
      return res.status(500).json({ status: 'error', message: 'Error reading system prompt' });
    }
    let date = new Date().toLocaleDateString('fr-FR');
    let heure = new Date().toLocaleTimeString('fr-FR');
    let systemPrompt = `Nous sommes le ${date} et il est ${heure}. ${data}`;
    return res.json({ prompt: systemPrompt });
  });
});

app.get('/greeting', (req, res) => {
  fs.readFile('config/greeting.txt', 'utf8', (err, data) => {
      if (err) {
      console.error('Error reading greeting:', err);
      return res.status(500).json({ status: 'error', message: 'Error reading greeting' });
      }
      return res.json({ greeting: `${data}` });
  });
});

app.post('/process', async (req, res) => {
  const text = req.body.text || '';
  let conversationHistory = req.body.conversationHistory || '';

  if (!text) {
    return res.json({ status: 'error', message: 'No text provided!' });
  }

  console.log('You said:', text);

  // Add user message to conversation history
//   conversationHistory += `user: ${text}\n`;
  console.log('Adding user transcript. Conversation history:', conversationHistory);

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: convertToGeminiFormat(conversationHistory)
      })
    });

    console.log('contents:', convertToGeminiFormat(conversationHistory));
    console.log('Gemini API response:', response);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return res.json({ status: 'error', message: 'Error communicating with Gemini', details: errorData });
    }

    const data = await response.json();
    const aiResponse = data.candidates[0].content.parts[0].text;
    console.log('model response:', aiResponse);

    // Add AI response to conversation history
    conversationHistory += `model: ${aiResponse}\n`;

    // Check if the AI response contains the reservation details in JSON format
    let reservationDetails;
    try {
      reservationDetails = JSON.parse(aiResponse);
    } catch (e) {
      reservationDetails = null;
    }

    return res.json({ status: 'success', message: 'Voice processed successfully!', text: text, aiResponse: aiResponse, reservationDetails: reservationDetails, conversationHistory: conversationHistory });
  } catch (error) {
    console.error('Error communicating with Gemini:', error);
    return res.json({ status: 'error', message: 'Error communicating with Gemini', details: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

