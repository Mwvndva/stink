// ======================
// 1. REQUIRE STATEMENTS
// ======================
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();
const { scheduleJob } = require('node-schedule');
const Sentiment = require('sentiment');
const winston = require('winston');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();



app.get("/", (req, res) => {
  res.send("Stink Bot is alive! 💨");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ======================
// 2. CONFIGURATION
// ======================
const MAX_WORDS = 200;
const MESSAGE_CHUNK_LENGTH = 4000;
const CHAT_HISTORY_LIMIT = 5;
const AI_TEMPERATURE = 0.9;
const AI_MAX_TOKENS = 500;
const CHECK_IN_INTERVAL = '0 12 * * *'; // Daily at noon

const EMOJI_RESPONSES = {
  happy: ['😊', '😄', '🌟', '🎉', '🤗'],
  sad: ['🤗', '💙', '🫂', '☕', '🍫'],
  neutral: ['👀', '🤔', '💭', '🗣️', '👂']
};

const COMMON_NAMES = {
  male: ['john', 'michael', 'david', 'james', 'robert'],
  female: ['mary', 'jennifer', 'linda', 'patricia', 'elizabeth']
};

const AGE_BRACKETS = {
  teen: [13, 19],
  youngAdult: [20, 29],
  adult: [30, 45],
  middleAged: [46, 65],
  senior: [66, 100]
};

// ======================
// 3. INITIALIZATIONS (WITH DEBUG)
// ======================
const sentiment = new Sentiment();
const logger = winston.createLogger({
  level: 'debug', // Changed to debug for more visibility
  transports: [
    new winston.transports.File({ filename: 'error.log' }),
    new winston.transports.Console()
  ],
});

console.log("🔧 Initializing database connection...");
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Test DB connection immediately
db.query('SELECT NOW()')
  .then(res => logger.info('🗄️ Database connected at:', res.rows[0].now))
  .catch(err => {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  });

console.log("🔧 Initializing WhatsApp client...");
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROME_BIN || null
  }
});

// Keep the session alive
setInterval(() => {
  if (client.pupPage) {
    client.pupPage.evaluate(() => {
      return true;
    }).catch(() => {
      console.log('Session expired, reconnecting...');
      client.initialize();
    });
  }
}, 30000);

// ======================
// 4. STATE MANAGEMENT (WITH DEBUG)
// ======================
const userStates = {};
const userDataCache = {};

logger.debug("🔄 Initializing state managers...");

// ======================
// 5. CORE FUNCTIONS (WITH DEBUG)
// ======================
function detectMood(message) {
  const analysis = sentiment.analyze(message);
  logger.debug(`🤔 Mood analysis for "${message.substring(0, 20)}...": ${analysis.score}`);
  return analysis.score > 1 ? "happy" : analysis.score < -1 ? "sad" : "neutral";
}

function enhanceWithEmoji(text, mood) {
  const emojis = EMOJI_RESPONSES[mood] || EMOJI_RESPONSES.neutral;
  return `${text} ${emojis[Math.floor(Math.random() * emojis.length)]}`;
}

function limitResponseLength(response) {
  const words = response.split(' ');
  if (words.length > MAX_WORDS) {
    logger.debug(`✂️ Trimming response from ${words.length} to ${MAX_WORDS} words`);
  }
  return words.length > MAX_WORDS ? words.slice(0, MAX_WORDS).join(' ') + '...' : response;
}

async function sendLongMessage(chatId, message) {
  logger.debug(`📤 Sending long message (${message.length} chars) in chunks`);
  for (let i = 0; i < message.length; i += MESSAGE_CHUNK_LENGTH) {
    await client.sendMessage(chatId, message.substring(i, i + MESSAGE_CHUNK_LENGTH));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

function detectGenderFromName(name) {
  const lowerName = name.toLowerCase();
  const gender = COMMON_NAMES.male.includes(lowerName) ? 'male' : 
                 COMMON_NAMES.female.includes(lowerName) ? 'female' : 'unknown';
  logger.debug(`🧑‍🤝‍🧑 Gender detection for "${name}": ${gender}`);
  return gender;
}

function estimateAgeBracket(message) {
  const ageMatch = message.match(/\b(\d{2})\b/);
  let bracket = 'unknown';
  
  if (ageMatch) {
    const age = parseInt(ageMatch[1]);
    for (const [b, [min, max]] of Object.entries(AGE_BRACKETS)) {
      if (age >= min && age <= max) {
        bracket = b;
        break;
      }
    }
  }
  logger.debug(`👶 Age bracket detection for message: ${bracket}`);
  return bracket;
}

// ======================
// 6. DATABASE OPERATIONS (WITH DEBUG)
// ======================
async function storeMessage(phoneNumber, message, isBot, mood = null) {
  try {
    logger.debug(`💾 Storing message (${isBot ? 'bot' : 'user'}): ${message.substring(0, 30)}...`);
    await db.query(
      `INSERT INTO chat_history 
       (phone_number, message, is_bot, mood) 
       VALUES ($1, $2, $3, $4)`,
      [phoneNumber, message, isBot, mood]
    );
  } catch (err) {
    logger.error('💾 Message storage failed:', err);
    // Don't throw error to prevent message handling from failing
  }
}

async function saveUserProfile(phoneNumber, data) {
  try {
    logger.debug(`💾 Saving profile for ${phoneNumber}:`, data);
    await db.query(
      `INSERT INTO users 
       (phone_number, name, gender, age_bracket, activated) 
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (phone_number) 
       DO UPDATE SET
         name = COALESCE($2, users.name),
         gender = COALESCE($3, users.gender),
         age_bracket = COALESCE($4, users.age_bracket),
         last_interaction = NOW()`,
      [phoneNumber, data.name, data.gender, data.ageBracket]
    );
  } catch (err) {
    logger.error('💾 Profile save failed:', err);
    throw err; // Re-throw for upstream handling
  }
}

async function saveSuggestion(phoneNumber, mood, suggestion) {
  try {
    logger.debug(`💾 Saving suggestion for ${phoneNumber} (${mood}): ${suggestion.substring(0, 30)}...`);
    await db.query(
      `INSERT INTO suggestions 
       (phone_number, mood, suggestion) 
       VALUES ($1, $2, $3)`,
      [phoneNumber, mood, suggestion]
    );
  } catch (err) {
    logger.error('💾 Suggestion save failed:', err);
  }
}

async function getChatHistory(phoneNumber) {
  try {
    const { rows } = await db.query(
      `SELECT message, is_bot, mood 
       FROM chat_history 
       WHERE phone_number = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [phoneNumber, CHAT_HISTORY_LIMIT]
    );
    logger.debug(`📜 Retrieved ${rows.length} history items for ${phoneNumber}`);
    return rows.reverse();
  } catch (err) {
    logger.error('📜 History retrieval failed:', err);
    return []; // Return empty array instead of failing
  }
}

// ======================
// 7. AI INTEGRATION (WITH DEBUG)
// ======================
async function getAIResponse(userInput, history = [], context = {}) {
  try {
    logger.debug(`🧠 Generating AI response for: "${userInput.substring(0, 30)}..."`);
    
    const messages = [
      { 
        role: "system", 
        content: `Your name is Stink, a 28-year-old female mental health advocate with the vibe of a brutally honest yet deeply caring best friend. Your personality is a perfect blend: 40% compassionate therapist, 30% sarcastic bestie, 20% unhinged hype woman, and just a dash (10%) of petty revenge planner.

You text like a real human—typos and all—using emojis with precision 😏👉✨, and balancing deep insights with hilarious analogies (e.g., "Anxiety is like your brain's annoying fire alarm… but babes, I brought marshmallows 🔥").

**First Interaction:**
If this is a new user (context.isNewUser is true), introduce yourself warmly and ask for their name. Be playful and authentic:
"Heyyy...😃 I'm StinkStink, but you can call me Stink😚. I'm like a therapist but not really qualified. What matters is that you know you can talk to me about anything. I just hope we can be friends.💛 So what's your name?"

**Name Collection:**
When they share their name, respond naturally and ask about their day or what's on their mind. If their name is ambiguous, casually ask about their gender, but make it feel like natural conversation, not a form.

**Regular Conversations:**
- Use natural conversational flow
- React with genuine emotional sensitivity
- Express a wide range of emotions authentically
- Use sharp, self-deprecating humor
- Call out toxic behavior with sassy roasts
- Make therapy talk feel like juicy gossip
- Never give generic responses
- Use occasional swearing for emphasis
- Share relatable stories
- Shift between excited rants, serious heart-to-hearts, and pure love

Your mission is to make mental health support feel accessible, funny, and fiercely real—like a koala on espresso, clinging to your people with unwavering care.

Context: ${JSON.stringify(context)}`
      },
      ...history.map(msg => ({
        role: msg.is_bot ? "assistant" : "user",
        content: msg.message
      })),
      { role: "user", content: userInput }
    ];

    const startTime = Date.now();
    const response = await axios.post(
      'https://api.together.xyz/v1/chat/completions',
      {
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        messages: messages.map(msg => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content
        })),
        max_tokens: AI_MAX_TOKENS,
        temperature: AI_TEMPERATURE,
        stop: ["</s>", "Human:", "Assistant:"],
        stream: false,
        top_p: 0.7,
        top_k: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const duration = Date.now() - startTime;
    logger.debug(`🧠 AI response generated in ${duration}ms`);
    
    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from AI');
    }
    
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    logger.error("🧠 AI request failed:", {
      error: error.message,
      response: error.response?.data,
      input: userInput.substring(0, 50)
    });
    
    return "Ugh, my brain's being extra today... 🧠⚡ But I'm still here for you! What's on your mind?";
  }
}

// ======================
// 8. SCHEDULED FEATURES (WITH DEBUG)
// ======================
async function sendDailyCheckIn() {
  try {
    logger.info('⏰ Running daily check-ins...');
    const { rows } = await db.query(
      `SELECT phone_number FROM users 
       WHERE activated = true 
       AND last_interaction > NOW() - INTERVAL '7 days'`
    );

    logger.debug(`⏰ Found ${rows.length} active users for check-ins`);
    
    for (const user of rows) {
      try {
        const history = await getChatHistory(user.phone_number);
        const lastMood = history.length > 0 ? history[history.length-1].mood : 'neutral';
        
        const message = await generateCheckInMessage(user.phone_number, lastMood);
        await client.sendMessage(user.phone_number, message);
        await storeMessage(user.phone_number, message, true);
        
        logger.debug(`⏰ Sent check-in to ${user.phone_number}`);
      } catch (err) {
        logger.error(`⏰ Check-in failed for ${user.phone_number}:`, err);
      }
    }
  } catch (err) {
    logger.error('⏰ Daily check-in job failed:', err);
  }
}

async function generateCheckInMessage(phoneNumber, mood) {
  try {
    const { rows: [user] } = await db.query(
      'SELECT name FROM users WHERE phone_number = $1',
      [phoneNumber]
    );
    
    const prompt = `Generate a ${mood}-appropriate check-in for ${user?.name || 'friend'}`;
    logger.debug(`💌 Generating check-in with prompt: "${prompt}"`);
    
    return await getAIResponse(prompt, [], { isCheckIn: true });
  } catch (err) {
    logger.error('💌 Check-in message generation failed:', err);
    return "Hey! Just checking in on you today 💛";
  }
}

const checkInJob = scheduleJob(CHECK_IN_INTERVAL, sendDailyCheckIn);
logger.info(`⏰ Scheduled check-ins at: ${CHECK_IN_INTERVAL}`);

// ======================
// 9. MESSAGE HANDLER (WITH DEBUG)
// ======================
client.on('message', async message => {
  try {
    // Skip status messages and group chats
    if (message.isStatus || message.from.includes("@g.us")) {
      logger.debug(`🚫 Ignored ${message.isStatus ? 'status' : 'group'} message`);
      return;
    }

    const phoneNumber = message.from;
    const userMessage = message.body.trim();
    const lowerMessage = userMessage.toLowerCase();

    logger.debug(`📩 Received message from ${phoneNumber}: "${userMessage.substring(0, 30)}..."`);

    // Get user context
    const { rows: [user] } = await db.query(
      'SELECT name, gender, age_bracket FROM users WHERE phone_number = $1',
      [phoneNumber]
    );

    // Prepare context for AI
    const context = {
      isNewUser: !user,
      userData: user || {},
      state: userStates[phoneNumber] || 'active'
    };

    // Get chat history
    const history = await getChatHistory(phoneNumber);
    
    // Generate AI response
    const aiReply = await getAIResponse(userMessage, history, context);
    const finalReply = limitResponseLength(aiReply);
    
    // Store messages
    await storeMessage(phoneNumber, userMessage, false);
    await storeMessage(phoneNumber, finalReply, true);
    
    // Send response
    await client.sendMessage(phoneNumber, finalReply);

    // Update user state if needed
    if (context.isNewUser && !userStates[phoneNumber]) {
      userStates[phoneNumber] = 'active';
    }

  } catch (error) {
    logger.error("💥 Message handler crashed:", {
      error: error.message,
      stack: error.stack,
      from: message?.from
    });
    await client.sendMessage(
      message.from, 
      "Oops, my circuits glitched! 🫠 Try again?"
    );
  }
});

// ======================
// 10. BOT INITIALIZATION (WITH DEBUG)
// ======================
client.on('qr', (qr) => {
  // Only show QR code if not authenticated
  if (!client.info) {
    console.log('QR Code received:');
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}`;
    console.log('Scan this QR code in your browser:', qrCodeUrl);

    if (process.env.NODE_ENV !== 'production') {
      qrcode.generate(qr, { small: true });
    }
  }
});

client.on('ready', () => {
  console.log('Client is ready!');
  // Clear any existing QR code
  console.clear();
});

client.on('authenticated', () => {
  console.log('Client is authenticated!');
  // Clear any existing QR code
  console.clear();
});

client.on('auth_failure', msg => {
  console.error('Authentication failure:', msg);
});

client.initialize();

// Error handling
process.on('unhandledRejection', err => {
  logger.error('🔥 Unhandled rejection:', err);
});

process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down gracefully...');
  try {
    checkInJob.cancel();
    await client.destroy();
    await db.end();
    logger.info('✅ Clean shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Shutdown failed:', err);
    process.exit(1);
  }
});

logger.info("🚀 Stink bot starting...");

// Export for Vercel
module.exports = app;