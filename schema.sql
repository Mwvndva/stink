CREATE TABLE users (
    phone_number VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100),
    gender VARCHAR(20),
    age_bracket VARCHAR(20),
    activated BOOLEAN DEFAULT true,
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) REFERENCES users(phone_number),
    message TEXT,
    is_bot BOOLEAN,
    mood VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suggestions (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) REFERENCES users(phone_number),
    mood VARCHAR(20),
    suggestion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 