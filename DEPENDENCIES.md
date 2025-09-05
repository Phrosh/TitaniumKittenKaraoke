# Karaoke System - Dependencies

## Backend Dependencies (Node.js)

### Production Dependencies
```
axios@^1.11.0                    # HTTP client for YouTube metadata extraction
bcryptjs@^2.4.3                  # Password hashing
cors@^2.8.5                      # Cross-Origin Resource Sharing
dotenv@^16.3.1                   # Environment variables
express@^4.18.2                  # Web framework
express-rate-limit@^7.1.5        # Rate limiting middleware
express-validator@^7.0.1         # Input validation
helmet@^7.1.0                    # Security headers
jsonwebtoken@^9.0.2              # JWT authentication
sqlite3@^5.1.6                   # SQLite database
```

### Development Dependencies
```
concurrently@^8.2.2              # Run multiple commands concurrently
nodemon@^3.1.10                  # Auto-restart server on changes
```

## Frontend Dependencies (React/TypeScript)

### Production Dependencies
```
@testing-library/jest-dom@^5.16.4     # Jest DOM matchers
@testing-library/react@^13.3.0        # React testing utilities
@testing-library/user-event@^13.5.0   # User event simulation
@types/jest@^27.5.2                   # Jest TypeScript definitions
@types/node@^16.11.56                 # Node.js TypeScript definitions
@types/qrcode@^1.5.0                 # QRCode TypeScript definitions
@types/react@^18.0.17                # React TypeScript definitions
@types/react-beautiful-dnd@^13.1.8    # React Beautiful DnD TypeScript definitions
@types/react-dom@^18.0.6             # React DOM TypeScript definitions
@types/styled-components@^5.1.26     # Styled Components TypeScript definitions
axios@^1.4.0                         # HTTP client
qrcode@^1.5.3                        # QR code generation
react@^18.2.0                        # React library
react-beautiful-dnd@^13.1.1          # Drag and drop (currently unused)
react-dom@^18.2.0                    # React DOM
react-hot-toast@^2.6.0               # Toast notifications
react-router-dom@^6.11.2             # React routing
react-scripts@5.0.1                  # Create React App scripts
styled-components@^6.0.7             # CSS-in-JS styling
typescript@^4.7.4                    # TypeScript compiler
web-vitals@^2.1.4                    # Web performance metrics
```

## Installation Commands

### Backend
```bash
npm install
```

### Frontend
```bash
cd client
npm install
```

### All Dependencies
```bash
npm run install-all
```

## System Requirements

- **Node.js**: v16+ (recommended: v18+)
- **npm**: v8+ (comes with Node.js)
- **Operating System**: Windows, macOS, Linux

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

## Quick Start

1. **Install all dependencies:**
   ```bash
   npm run install-all
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Show View: http://localhost:3000/show
   - Admin: http://localhost:3000/admin

## Key Features

- **Song Request System**: Users can request songs via QR code
- **Admin Dashboard**: Manage playlist, reorder songs, add YouTube links
- **Show View**: Fullscreen YouTube video with overlay information
- **Automatic Metadata**: YouTube links automatically extract title/artist
- **Priority System**: Fair playlist ordering with regression
- **Drag & Drop**: Reorder songs in admin dashboard
- **Real-time Updates**: Auto-refresh every 2 seconds
