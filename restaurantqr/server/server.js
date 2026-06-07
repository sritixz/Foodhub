import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';

// Import routes
import authRoutes from './routes/auth.js';
import outletRoutes from './routes/outlets.js';
import menuItemRoutes from './routes/menuItems.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import userRoutes from './routes/users.js';
import qrCodeRoutes from './routes/qrcode.js';
import uploadRoutes from './routes/upload.js';
import notificationRoutes from './routes/notifications.js';
import vendorRoutes from './routes/vendors.js';
import locationRoutes from './routes/locations.js';
import warehouseRoutes from './routes/warehouse.js';
import reportRoutes from './routes/reports.js';
import categoryRoutes from './routes/categories.js';
import budgetRoutes from './routes/budgets.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'FoodHub API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/qrcode', qrCodeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);

// QR Code public endpoint (for scanning)
app.get('/qr/:qrData', async (req, res) => {
  try {
    const { qrData } = req.params;
    const QRCode = (await import('./models/QRCode.js')).default;
    const MenuItem = (await import('./models/MenuItem.js')).default;
    
    const qrCode = await QRCode.findOne({ qrCodeData: qrData, isActive: true })
      .populate('outlet', 'name outletId logo');

    if (!qrCode) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Code Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>QR Code Not Found</h1>
          <p>This QR code is invalid or has been deactivated.</p>
        </body>
        </html>
      `);
    }

    // Get menu items
    const menuItems = await MenuItem.find({
      $or: [
        { vendor: qrCode.outlet._id },
        { outlets: qrCode.outlet._id },
        { applyToAll: true },
      ],
      status: 'Available',
    })
      .populate('vendor', 'name outletId')
      .sort({ category: 1, name: 1 });

    // Update scan count
    qrCode.scanCount += 1;
    qrCode.lastScanned = new Date();
    await qrCode.save();

    // Return HTML page for ordering
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${qrCode.outlet.name} - Order Menu</title>
        <style>
          body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f8fafc;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .outlet-header {
            text-align: center;
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e2e8f0;
          }
          .outlet-name {
            font-size: 24px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 8px;
          }
          .menu-section {
            margin-bottom: 32px;
          }
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 16px;
          }
          .menu-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 12px;
          }
          .item-info {
            flex: 1;
          }
          .item-name {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 4px;
          }
          .item-price {
            color: #64748b;
            font-size: 14px;
          }
          .add-btn {
            background: #ff6b35;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
          }
          .add-btn:hover {
            background: #e55a2b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="outlet-header">
            <div class="outlet-name">${qrCode.outlet.name}</div>
            <div style="color: #64748b;">Scan & Order</div>
          </div>
          <div id="menu-container">
            ${renderMenuItems(menuItems)}
          </div>
        </div>
        <script>
          // This will be implemented in the frontend React app
          // For now, this is a placeholder page
          console.log('QR Code Data:', '${qrData}');
          console.log('Outlet:', ${JSON.stringify(qrCode.outlet)});
          console.log('Menu Items:', ${JSON.stringify(menuItems)});
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>Error</h1>
        <p>An error occurred while loading the menu.</p>
      </body>
      </html>
    `);
  }
});

// Helper function to render menu items
function renderMenuItems(menuItems) {
  const grouped = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  let html = '';
  for (const [category, items] of Object.entries(grouped)) {
    html += `
      <div class="menu-section">
        <div class="section-title">${category}</div>
        ${items.map(item => `
          <div class="menu-item">
            <div class="item-info">
              <div class="item-name">${item.name}</div>
              <div class="item-price">₹${item.basePrice}</div>
            </div>
            <button class="add-btn" onclick="addToCart('${item._id}')">Add</button>
          </div>
        `).join('')}
      </div>
    `;
  }
  return html;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
