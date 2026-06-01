import { defaultOutlets, defaultInventory, defaultMenuItems, defaultOrders, defaultUsers } from './dataModels';

// Initialize default data if localStorage is empty
const initializeData = () => {
  if (!localStorage.getItem('outlets')) {
    localStorage.setItem('outlets', JSON.stringify(defaultOutlets));
  }
  if (!localStorage.getItem('inventory')) {
    localStorage.setItem('inventory', JSON.stringify(defaultInventory));
  }
  if (!localStorage.getItem('menuItems')) {
    localStorage.setItem('menuItems', JSON.stringify(defaultMenuItems));
  }
  if (!localStorage.getItem('orders')) {
    localStorage.setItem('orders', JSON.stringify(defaultOrders));
  }
  if (!localStorage.getItem('users')) {
    localStorage.setItem('users', JSON.stringify(defaultUsers));
  }
};

// Initialize on import
initializeData();

/**
 * Retrieve data from localStorage
 * @param {string} key - Storage key
 * @returns {Array} Parsed data array
 */
export const getData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return [];
  }
};

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {Array} data - Data array to save
 */
export const saveData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

/**
 * Add new item to localStorage
 * @param {string} key - Storage key
 * @param {Object} item - Item to add
 * @returns {Object} Added item with generated ID
 */
export const addData = (key, item) => {
  const data = getData(key);
  const newItem = {
    ...item,
    id: item.id || `${key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.push(newItem);
  saveData(key, data);
  return newItem;
};

/**
 * Update specific item in localStorage
 * @param {string} key - Storage key
 * @param {string} id - Item ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated item or null if not found
 */
export const updateData = (key, id, updates) => {
  const data = getData(key);
  const index = data.findIndex(item => item.id === id);
  if (index === -1) return null;
  
  data[index] = {
    ...data[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveData(key, data);
  return data[index];
};

/**
 * Delete specific item from localStorage
 * @param {string} key - Storage key
 * @param {string} id - Item ID
 * @returns {boolean} True if deleted, false if not found
 */
export const deleteData = (key, id) => {
  const data = getData(key);
  const filtered = data.filter(item => item.id !== id);
  if (filtered.length === data.length) return false;
  
  saveData(key, filtered);
  return true;
};

/**
 * Get single item by ID
 * @param {string} key - Storage key
 * @param {string} id - Item ID
 * @returns {Object|null} Item or null if not found
 */
export const getItemById = (key, id) => {
  const data = getData(key);
  return data.find(item => item.id === id) || null;
};
