# Project Structure & Organization

## Root Structure
```
├── myapp/           # React frontend application
├── server/          # Express.js backend API
├── .kiro/           # Kiro configuration and specs
└── *.md             # Documentation files
```

## Frontend Structure (myapp/)

```
myapp/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── UI/        # Base UI components (Button, Card, Input, etc.)
│   │   └── Layout/    # Layout components
│   ├── pages/         # Route-level page components
│   ├── context/       # React Context providers (AuthContext)
│   ├── hooks/         # Custom React hooks
│   ├── utils/         # Utility functions and API clients
│   ├── tests/         # Test files and setup
│   └── stitch/        # Generated/imported components
├── public/            # Static assets
└── config files       # Vite, ESLint, Vitest configs
```

### Component Organization
- **UI Components**: Atomic, reusable components in `components/UI/`
- **Feature Components**: Business logic components in `components/`
- **Pages**: Route-level components in `pages/` (one per route)
- **Context**: Global state management in `context/`

### Naming Conventions
- **Components**: PascalCase (e.g., `MenuItemCard.jsx`)
- **Pages**: PascalCase matching route names
- **Utilities**: camelCase (e.g., `localStorage.js`)
- **Tests**: Component name + `.test.jsx`

## Backend Structure (server/)

```
server/
├── routes/           # Express route handlers
├── models/           # Mongoose data models
├── middleware/       # Express middleware (auth, upload, etc.)
├── config/           # Configuration files (database, S3)
├── utils/            # Utility functions
├── scripts/          # Database seeding and maintenance
└── tests/            # API and integration tests
```

### API Organization
- **Routes**: RESTful endpoints grouped by resource
- **Models**: Mongoose schemas with validation
- **Middleware**: Reusable request processing (auth, file upload)
- **Utils**: Helper functions for S3, validation, etc.

### File Naming
- **Routes**: Plural resource names (e.g., `outlets.js`, `menuItems.js`)
- **Models**: Singular PascalCase (e.g., `MenuItem.js`, `Order.js`)
- **Tests**: Feature name + `.test.js`

## Key Architectural Patterns

### Frontend Patterns
- **Component Composition**: UI components composed from smaller parts
- **Context Pattern**: Global state via React Context
- **Protected Routes**: Role-based route access control
- **API Layer**: Centralized API calls in `utils/api.js`

### Backend Patterns
- **RESTful API**: Standard HTTP methods and status codes
- **Middleware Chain**: Authentication, validation, error handling
- **Model-Route Separation**: Business logic in models, HTTP handling in routes
- **Real-time Updates**: SSE for live order status updates

### Data Flow
1. **Frontend → API**: Axios requests to Express routes
2. **API → Database**: Mongoose models interact with MongoDB
3. **Real-time**: SSE streams for live updates
4. **File Uploads**: Direct to AWS S3 via presigned URLs

## Configuration Files

- **Frontend**: `vite.config.js`, `vitest.config.js`, `eslint.config.js`
- **Backend**: `jest.config.js`, `.env` for environment variables
- **Shared**: Package.json files with scripts and dependencies