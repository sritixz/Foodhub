// Data models for JSON-ready structures

export const defaultOutlets = [
  {
    id: '1',
    name: 'AURUM',
    outletId: 'OUT001',
    fssaiLicense: 'FSSAI/2024/12345',
    businessType: 'Dine-In',
    contact: {
      name: 'John Smith',
      email: 'john.smith@aurum.com',
      phone: '+91 98765 43210'
    },
    location: {
      address: '123 Food Street, Culinary District',
      state: 'Maharashtra',
      city: 'Mumbai',
      zone: 'North Zone',
      totalOutlets: 1
    },
    documents: {
      rentAgreement: null,
      fssaiLicense: null,
      otherDocs: []
    },
    sales: {
      today: 45000,
      monthly: 1250000
    },
    logo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'PLATINUM DINE',
    outletId: 'OUT002',
    fssaiLicense: 'FSSAI/2024/67890',
    businessType: 'Delivery-Only',
    contact: {
      name: 'Jane Doe',
      email: 'jane.doe@platinum.com',
      phone: '+91 98765 43211'
    },
    location: {
      address: '456 Park Avenue',
      state: 'Maharashtra',
      city: 'Mumbai',
      zone: 'South Zone',
      totalOutlets: 1
    },
    documents: {
      rentAgreement: null,
      fssaiLicense: null,
      otherDocs: []
    },
    sales: {
      today: 32200,
      monthly: 980500
    },
    logo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const defaultInventory = [
  {
    id: '1',
    name: 'Fresh Tomatoes',
    sku: 'ING001',
    unit: 'Kg',
    quantity: 45,
    threshold: 50,
    branch: 'Main Branch',
    lastUpdated: '2024-01-20 14:30'
  },
  {
    id: '2',
    name: 'Chicken Breast',
    sku: 'ING002',
    unit: 'Kg',
    quantity: 15,
    threshold: 20,
    branch: 'Downtown Branch',
    lastUpdated: '2024-01-20 12:15'
  },
  {
    id: '3',
    name: 'Cooking Oil',
    sku: 'ING003',
    unit: 'L',
    quantity: 80,
    threshold: 30,
    branch: 'Main Branch',
    lastUpdated: '2024-01-19 16:45'
  },
  {
    id: '4',
    name: 'Rice',
    sku: 'ING004',
    unit: 'Kg',
    quantity: 15,
    threshold: 25,
    branch: 'Downtown Branch',
    lastUpdated: '2024-01-19 09:20'
  }
];

export const defaultMenuItems = [];

export const defaultOrders = [
  {
    id: 'ORD-2401',
    customer: 'John Smith',
    orderType: 'Retail',
    vendor: 'Burger King',
    deliveryMode: 'Delivery',
    amount: 45.99,
    status: 'New',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    outlet: 'Main Branch'
  },
  {
    id: 'ORD-2400',
    customer: 'Tech Corp',
    orderType: 'Bulk',
    vendor: 'Subway',
    deliveryMode: 'Pickup',
    amount: 289.99,
    status: 'Preparing',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    outlet: 'Downtown Branch'
  },
  {
    id: 'ORD-2399',
    customer: 'Sarah Johnson',
    orderType: 'Retail',
    vendor: 'Pizza Hut',
    deliveryMode: 'Dine-in',
    amount: 32.50,
    status: 'Ready',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    outlet: 'Main Branch'
  }
];

export const defaultUsers = [
  {
    id: '1',
    name: 'Sarah Johnson',
    role: 'Company Admin',
    outlet: 'Downtown Branch',
    email: 'sarah.j@foodsystem.com',
    phone: '+1 (555) 123-4567',
    status: 'Active'
  },
  {
    id: '2',
    name: 'Michael Chen',
    role: 'Delivery Staff',
    outlet: 'West Side Branch',
    email: 'm.chen@foodsystem.com',
    phone: '+1 (555) 234-5678',
    status: 'Active'
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    role: 'Vendor',
    outlet: 'East Side Branch',
    email: 'e.rodriguez@foodsystem.com',
    phone: '+1 (555) 345-6789',
    status: 'Active'
  },
  {
    id: '4',
    name: 'David Kim',
    role: 'Employee',
    outlet: 'North Branch',
    email: 'd.kim@foodsystem.com',
    phone: '+1 (555) 456-7890',
    status: 'Active'
  },
  {
    id: '5',
    name: 'Lisa Thompson',
    role: 'Company Admin',
    outlet: 'South Branch',
    email: 'l.thompson@foodsystem.com',
    phone: '+1 (555) 567-8901',
    status: 'Active'
  }
];
