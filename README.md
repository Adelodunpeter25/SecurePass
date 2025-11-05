# SecurePass - Chrome Extension Password Manager

A secure password manager Chrome extension with auto-fill capabilities.

## Features

- Auto-detect login forms on websites
- Client-side encryption using AES-GCM
- Secure password generation
- Auto-fill credentials with one click
- Backend API with PostgreSQL storage

## Setup

### Backend Setup

1. Install PostgreSQL and create database:
```bash
psql -U postgres -f backend/schema.sql
```

2. Install dependencies:
```bash
cd backend
npm install
```

3. Start the server:
```bash
npm run dev
```

### Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the project root directory
4. The SecurePass extension should now appear in your extensions

## Usage

1. Click the SecurePass extension icon
2. Set your master password (first time)
3. Navigate to any login page
4. Click the 🔐 button next to username fields to auto-fill
5. Save new passwords through the extension popup

## Security

- Passwords are encrypted client-side using PBKDF2 + AES-GCM
- Master password never leaves your browser
- Server only stores encrypted password blobs
- Each password is encrypted with a unique IV

## API Endpoints

- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `GET /api/passwords/:domain` - Get credentials for domain
- `POST /api/passwords` - Save new password
- `GET /api/passwords` - List all saved passwords
