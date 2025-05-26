require('dotenv').config();
const axios = require('axios');

const GROK_API_KEY = 'xai-MQx5A9F3eXmmPBZ6GfWjdohGFyldXG7HW4Cvk2Eo2bawspzj17PD6XeY2QRiv3CRFarApM4LZ9nCk6T8';

async function testGrokAPI() {
  console.log('Testing GROK API connection...');
  console.log('API Key:', GROK_API_KEY ? 'Present' : 'Missing');
  
  try {
    console.log('\nSending test request...');
    const response = await axios.post(
      'https://api.grok.ai/v1/chat/completions',
      {
        model: "grok-1",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say hello!" }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('\nResponse Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\nError Details:');
    console.error('Message:', error.message);
    console.error('Response:', error.response?.data);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
  }
}

testGrokAPI(); 