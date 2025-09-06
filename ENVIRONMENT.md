# Environment Configuration

## Server Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
DB_PATH=./karaoke.db

# Server URL (for API calls from client)
SERVER_URL=http://localhost:5000

# Client URL (for QR code generation)
CLIENT_URL=http://localhost:3000
```

## Client Environment Variables

Create a `.env` file in the `client/` directory with the following variables:

```env
# Client Configuration
REACT_APP_SERVER_URL=http://localhost:5000
REACT_APP_CLIENT_URL=http://localhost:3000
```

## Setup Commands

### Quick Setup
```bash
npm run env:setup
```

This will copy the example environment files to the correct locations.

### Manual Setup

**Windows:**
```cmd
# Copy server environment
copy server.env .env

# Copy client environment
copy client\client.env client\.env
```

**Linux/Mac:**
```bash
# Copy server environment
cp server.env .env

# Copy client environment
cp client/client.env client/.env
```

## Production Configuration

For production deployment, update the URLs in your `.env` files:

**Server (.env):**
```env
PORT=5000
NODE_ENV=production
SERVER_URL=https://your-domain.com
CLIENT_URL=https://your-domain.com
```

**Client (client/.env):**
```env
REACT_APP_SERVER_URL=https://your-domain.com
REACT_APP_CLIENT_URL=https://your-domain.com
```

## Environment Variable Usage

- **SERVER_URL**: Used by the client to make API calls
- **CLIENT_URL**: Used by the server for QR code generation
- **PORT**: Server port (default: 5000)
- **NODE_ENV**: Environment mode (development/production)

## Notes

- The `.env` files are gitignored and should not be committed
- Use the example files (`server.env`, `client/client.env`) as templates
- Restart the server after changing environment variables
- The client will automatically reload when environment variables change
