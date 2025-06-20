# Stink Bot

A WhatsApp chatbot for mental health support, built with Node.js and the whatsapp-web.js library. The bot uses Together AI (Mixtral) for generating responses and PostgreSQL for storing user data and chat history.

## Features

- **WhatsApp Integration**: Connect to WhatsApp via QR code scanning.
- **AI-Powered Responses**: Uses Together AI (Mixtral) to generate personalized, empathetic responses.
- **Mood Detection**: Analyzes user messages to detect mood and tailor responses.
- **Daily Check-ins**: Sends scheduled check-in messages to active users.
- **Database Storage**: Stores user profiles, chat history, and suggestions in PostgreSQL.

## Prerequisites

- Node.js (v18 or later)
- PostgreSQL database
- Together AI API key
- Chromium (for Puppeteer)

## Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd stink-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   DATABASE_URL=your_postgres_connection_string
   TOGETHER_API_KEY=your_together_ai_api_key
   CHROME_BIN=/usr/bin/chromium
   ```

4. **Initialize the database:**
   Run the database initialization script:
   ```bash
   node init-db.js
   ```

5. **Start the bot:**
   ```bash
   node index.js
   ```

6. **Scan the QR code:**
   Open WhatsApp on your phone, go to Settings > Linked Devices, and scan the QR code displayed in the terminal.

## Deployment

### Deploying to Render

1. **Push your code to GitHub.**

2. **Create a `render.yaml` file:**
   ```yaml
   services:
     - type: web
       name: stink-bot
       env: node
       buildCommand: npm install
       startCommand: node index.js
       envVars:
         - key: DATABASE_URL
           fromDatabase:
             name: stink-db
             property: connectionString
         - key: TOGETHER_API_KEY
           sync: false
         - key: CHROME_BIN
           value: /usr/bin/chromium

   databases:
     - name: stink-db
       databaseName: stink_bot
       user: stink_user
       plan: free
   ```

3. **Deploy on Render:**
   - Sign up/log in to [Render.com](https://render.com).
   - Connect your GitHub repository.
   - Create a new Web Service and PostgreSQL database.
   - Set the environment variables as specified in `render.yaml`.
   - Deploy!

## Database Schema

The following tables are created automatically by `init-db.js`:
- `users`: Stores user info (phone_number, name, gender, age_bracket, etc.)
- `chat_history`: Stores chat messages linked to users
- `suggestions`: Stores suggestions linked to users

## License

This project is licensed under the MIT License.
