const axios = require('axios');

const TOGETHER_API_KEY = 'e6e15219c18c6a6d16eb17ac147c7412618da6a1f136a566b16bec8b925cad51';

async function testTogetherAPI() {
  console.log('Testing Together AI API connection...');
  
  try {
    console.log('\nSending test request...');
    const response = await axios.post(
      'https://api.together.xyz/v1/chat/completions',
      {
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say hello!" }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
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

testTogetherAPI(); 