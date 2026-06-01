# Technology Stack & Build System

## Frontend (myapp/)

**Framework**: React 19.2.0 with Vite build system
**Routing**: React Router DOM v6
**HTTP Client**: Axios
**Styling**: CSS with component-based architecture
**State Management**: React Context (AuthContext)

### Build System
- **Bundler**: Vite 7.2.4
- **Dev Server**: Vite dev server with HMR
- **Linting**: ESLint with React hooks and refresh plugins
- **Testing**: Vitest with jsdom environment, React Testing Library

### Common Commands
```bash
# Frontend development
cd myapp
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test         # Run tests with Vitest
npm run test:ui      # Run tests with UI
```

## Backend (server/)

**Runtime**: Node.js with ES modules
**Framework**: Express.js 4.18.2
**Database**: MongoDB with Mongoose ODM
**Authentication**: JWT with bcryptjs
**File Storage**: AWS S3 with multer for uploads
**Real-time**: Server-Sent Events (SSE) for order updates

### Key Dependencies
- **QR Code Generation**: qrcode library
- **Cloud Storage**: AWS SDK v3 for S3
- **Testing**: Jest with MongoDB Memory Server
- **Development**: Nodemon for auto-restart

### Common Commands
```bash
# Backend development
cd server
npm run dev          # Start with nodemon
npm start            # Production start
npm test             # Run Jest tests
npm run test:watch   # Watch mode testing
npm run seed:users   # Seed initial users
```

## Development Environment

**Module System**: ES modules (type: "module" in package.json)
**Environment**: Node.js with cross-platform support
**Database**: MongoDB (local or MongoDB Atlas)
**File Uploads**: AWS S3 integration

## Testing Strategy

- **Frontend**: Vitest + React Testing Library + jsdom
- **Backend**: Jest + Supertest + MongoDB Memory Server
- **Property-based Testing**: Supported for correctness validation
- **Coverage**: Configured for routes, models, middleware, and utils

## Environment Configuration

Both frontend and backend use `.env` files for configuration:
- Database connections (MongoDB URI)
- JWT secrets
- AWS S3 credentials
- API base URLs
- Port configurations