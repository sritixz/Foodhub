# FoodHub Server

Backend server for FoodHub Restaurant Management System with QR code scanning and real-time order updates.

## Features

- RESTful API for all entities (Outlets, Menu Items, Orders, Inventory, Users)
- MongoDB database integration
- QR code generation and scanning
- Server-Sent Events (SSE) for real-time order updates
- Public QR code URLs for restaurant ordering

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the server directory:
```env
MONGO_URI=mongodb+srv://pincodex6_db_user:w5ROzfRIuxlOfWJe@aijobmate.qtrpun6.mongodb.net/
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here
BASE_URL=http://localhost:5000
```

3. Start the server:
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

## API Endpoints

### Outlets
- `GET /api/outlets` - Get all outlets
- `GET /api/outlets/:id` - Get single outlet
- `POST /api/outlets` - Create outlet
- `PUT /api/outlets/:id` - Update outlet
- `DELETE /api/outlets/:id` - Delete outlet
- `POST /api/outlets/:id/qrcode` - Generate QR code for outlet

### Menu Items
- `GET /api/menu-items` - Get all menu items
- `GET /api/menu-items/outlet/:outletId` - Get menu items by outlet (for QR scanning)
- `GET /api/menu-items/:id` - Get single menu item
- `POST /api/menu-items` - Create menu item
- `PUT /api/menu-items/:id` - Update menu item
- `DELETE /api/menu-items/:id` - Delete menu item

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/outlet/:outletId` - Get orders by outlet
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `PATCH /api/orders/:id/status` - Update order status
- `DELETE /api/orders/:id` - Delete order
- `GET /api/orders/stream` - SSE endpoint for real-time order updates

### Inventory
- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/:id` - Get single inventory item
- `POST /api/inventory` - Create inventory item
- `PUT /api/inventory/:id` - Update inventory item
- `PATCH /api/inventory/:id/quantity` - Update inventory quantity
- `POST /api/inventory/transfer` - Transfer stock between outlets
- `DELETE /api/inventory/:id` - Delete inventory item

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### QR Codes
- `GET /api/qrcode/scan/:qrData` - Get QR code data and menu (for scanning)
- `GET /api/qrcode/outlet/:outletId` - Get QR codes for outlet
- `POST /api/qrcode/outlet/:outletId` - Generate QR code for outlet
- `GET /api/qrcode/image/:qrData` - Get QR code image
- `PATCH /api/qrcode/:id/status` - Toggle QR code active status

### Public QR Endpoint
- `GET /qr/:qrData` - Public URL for QR code scanning (returns HTML page with menu)

## Real-time Updates

The server uses Server-Sent Events (SSE) for real-time order updates. Connect to `/api/orders/stream` to receive order updates:

```javascript
const eventSource = new EventSource('http://localhost:5000/api/orders/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'order_update') {
    console.log('New order update:', data.order);
  }
};
```

## QR Code Flow

1. Generate QR code for an outlet: `POST /api/qrcode/outlet/:outletId`
2. QR code contains a unique URL: `http://your-domain.com/qr/:qrData`
3. When scanned, the URL returns a menu page
4. Orders placed via QR code include the `qrCodeId` field

## Database Models

- **Outlet**: Restaurant outlet information
- **MenuItem**: Menu items with variants and availability
- **Order**: Orders with items and status tracking
- **Inventory**: Stock management per outlet
- **User**: System users with roles
- **QRCode**: QR code data and scan tracking

## Environment Variables

- `MONGO_URI`: MongoDB connection string
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)
- `JWT_SECRET`: Secret key for JWT tokens (if implementing auth)
- `BASE_URL`: Base URL for QR code generation
