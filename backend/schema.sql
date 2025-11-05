-- Create database
CREATE DATABASE securepass;

-- Connect to the database
\c securepass;

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create passwords table
CREATE TABLE passwords (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    website VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    password_blob TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_passwords_user_id ON passwords(user_id);
CREATE INDEX idx_passwords_website ON passwords(website);
CREATE INDEX idx_passwords_user_website ON passwords(user_id, website);
