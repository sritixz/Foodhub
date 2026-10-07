// Data models for JSON-ready structures

export const defaultOutlets = [
  // Corporate Clients
  {
    id: '1',
    name: 'Deepak Nitrite Limited',
    outletId: 'CORP001',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP001',
    businessType: 'Restaurant',
    contact: { name: 'Deepak Nitrite Admin', email: 'foodcourt@deepaknitrite.com', phone: '+91 98765 00001' },
    location: { address: 'Deepak Nitrite Campus, Nandesari', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 12500, monthly: 345000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Air Products',
    outletId: 'CORP002',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP002',
    businessType: 'Restaurant',
    contact: { name: 'Air Products Admin', email: 'cafeteria@airproducts.com', phone: '+91 98765 00002' },
    location: { address: 'Air Products Office Park, Sayajigunj', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 9800, monthly: 280000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Tata Consulting Engineers',
    outletId: 'CORP003',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP003',
    businessType: 'Restaurant',
    contact: { name: 'TCE Cafeteria Manager', email: 'foodcourt@tce.co.in', phone: '+91 98765 00003' },
    location: { address: 'TCE Tower, Akota', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 15400, monthly: 412000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '4',
    name: 'Kotak Mahindra Bank',
    outletId: 'CORP004',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP004',
    businessType: 'Restaurant',
    contact: { name: 'Kotak Admin', email: 'cafeteria@kotak.com', phone: '+91 98765 00004' },
    location: { address: 'Kotak Financial Hub, Alkapuri', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 11200, monthly: 310000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '5',
    name: 'Xylem Water Solutions India Pvt Ltd',
    outletId: 'CORP005',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP005',
    businessType: 'Restaurant',
    contact: { name: 'Xylem Admin', email: 'foodcourt@xylem.com', phone: '+91 98765 00005' },
    location: { address: 'Xylem Campus, Savli GIDC', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 8700, monthly: 240000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '6',
    name: 'Collabera',
    outletId: 'CORP006',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP006',
    businessType: 'Restaurant',
    contact: { name: 'Collabera Cafeteria Team', email: 'foodcourt@collabera.com', phone: '+91 98765 00006' },
    location: { address: 'Collabera House, Gotri Road', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 18200, monthly: 510000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '7',
    name: 'Kent PLC',
    outletId: 'CORP007',
    category: 'Corporate Client',
    isPrivate: true,
    fssaiLicense: 'FSSAI/2026/CORP007',
    businessType: 'Restaurant',
    contact: { name: 'Kent PLC Admin', email: 'cafeteria@kentplc.com', phone: '+91 98765 00007' },
    location: { address: 'Kent Engineering Complex, Subhanpura', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 9400, monthly: 265000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Commercial / Office Complexes
  {
    id: '8',
    name: 'Panorama Complex- Alkapuri',
    outletId: 'COMM001',
    category: 'Commercial/Office Complex',
    isPrivate: false,
    fssaiLicense: 'FSSAI/2026/COMM001',
    businessType: 'Restaurant',
    contact: { name: 'Panorama MOPY Outlet', email: 'panorama@mopy.co.in', phone: '+91 98765 00008' },
    location: { address: 'Panorama Complex, RC Dutt Road, Alkapuri', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 24500, monthly: 680000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '9',
    name: 'Nilamber Triumph- Gotri Vasna Road',
    outletId: 'COMM002',
    category: 'Commercial/Office Complex',
    isPrivate: false,
    fssaiLicense: 'FSSAI/2026/COMM002',
    businessType: 'Restaurant',
    contact: { name: 'Nilamber MOPY Outlet', email: 'nilamber@mopy.co.in', phone: '+91 98765 00009' },
    location: { address: 'Nilamber Triumph, Main Gotri Vasna Road', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 21300, monthly: 590000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '10',
    name: 'Neptune Edge - Sarabhai Complex',
    outletId: 'COMM003',
    category: 'Commercial/Office Complex',
    isPrivate: false,
    fssaiLicense: 'FSSAI/2026/COMM003',
    businessType: 'Restaurant',
    contact: { name: 'Neptune Edge MOPY Outlet', email: 'neptune@mopy.co.in', phone: '+91 98765 00010' },
    location: { address: 'Neptune Edge, Sarabhai Campus, Vadiwadi', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 19800, monthly: 540000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '11',
    name: 'Golden Icon - Chakli Circle',
    outletId: 'COMM004',
    category: 'Commercial/Office Complex',
    isPrivate: false,
    fssaiLicense: 'FSSAI/2026/COMM004',
    businessType: 'Restaurant',
    contact: { name: 'Golden Icon MOPY Outlet', email: 'goldenicon@mopy.co.in', phone: '+91 98765 00011' },
    location: { address: 'Golden Icon, Near Chakli Circle, OP Road', state: 'Gujarat', city: 'Vadodara', zone: 'West Zone', totalOutlets: 1 },
    sales: { today: 22100, monthly: 610000 },
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
