require('dotenv').config();
const axios = require('axios');

async function testGrokAPI() {
  try {
    const response = await axios.post(
      'https://api.grok.ai/v1/chat/completions',
      {
        model: "grok-1",
        messages: [{ role: "user", content: "test" }]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    console.log('API Response:', response.data);
  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      response: error.response?.data
    });
  }
}

testGrokAPI(); 