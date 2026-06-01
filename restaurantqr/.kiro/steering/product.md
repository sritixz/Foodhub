# FoodHub - Restaurant Management System

FoodHub is a comprehensive restaurant management platform that enables multi-outlet food businesses to manage their operations through QR code-based ordering, inventory management, and real-time order tracking.

## Core Features

- **Multi-outlet Management**: Manage multiple restaurant outlets from a single platform
- **QR Code Ordering**: Customers scan QR codes to access menus and place orders
- **Real-time Order Tracking**: Live order status updates using Server-Sent Events (SSE)
- **Inventory Management**: Track stock levels across outlets and warehouses
- **Role-based Access**: Different user roles (Admin, Company Admin, Vendor, Delivery Staff)
- **Menu Management**: Dynamic menu items with variants and availability controls
- **Delivery Management**: Location-based delivery tracking and management
- **Reporting & Analytics**: Business insights and operational reports

## User Roles

- **Admin**: Full system access
- **Company Admin**: Company-wide management capabilities
- **Vendor**: Menu and outlet management for assigned locations
- **Delivery Staff**: Order delivery and tracking
- **Customer**: QR code scanning and ordering (public access)

## Key Business Flows

1. **QR Code Flow**: Generate QR codes → Customer scans → Menu display → Order placement
2. **Order Management**: Order creation → Status updates → Real-time notifications → Delivery
3. **Inventory Flow**: Stock management → Transfer between outlets → Availability updates
4. **Multi-tenant**: Support for multiple restaurant chains with isolated data