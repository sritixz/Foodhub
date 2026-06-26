import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const MenuBrowse = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFoodType, setSelectedFoodType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const priceDebounceRef = useRef(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories');
        setCategories([{ _id: 'all', name: 'All' }, ...response.data]);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories([{ _id: 'all', name: 'All' }]);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Initial load
  useEffect(() => {
    fetchMenuItems(true);
  }, []);

  // Re-fetch on filter changes (no full-page spinner)
  useEffect(() => {
    fetchMenuItems(false);
  }, [searchTerm, selectedCategory, selectedFoodType, selectedStatus]);

  // Debounce price filter changes
  useEffect(() => {
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      fetchMenuItems(false);
    }, 400);
    return () => clearTimeout(priceDebounceRef.current);
  }, [minPrice, maxPrice]);

  const fetchMenuItems = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setFetching(true);
      const params = {};
      if (searchTerm) params.q = searchTerm;
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedFoodType !== 'All') params.foodType = selectedFoodType;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;

      // Vendor and Delivery Staff only see their outlet's menu
      if (['Vendor', 'Delivery Staff'].includes(user?.role) && user?.outlet) {
        params.outlet = user.outlet._id || user.outlet;
      }

      const response = await api.get('/menu-items', { params });
      setMenuItems(response.data);
      setFilteredItems(response.data);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  };


  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await api.delete(`/menu-items/${id}`);
        fetchMenuItems(false);
      } catch (error) {
        alert('Failed to delete menu item');
      }
    }
  };

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'Available' ? 'Paused' : 'Available';
    try {
      await api.patch(`/menu-items/${item._id}/status`, { status: newStatus });
      setMenuItems((prev) => prev.map((m) => m._id === item._id ? { ...m, status: newStatus } : m));
      setFilteredItems((prev) => prev.map((m) => m._id === item._id ? { ...m, status: newStatus } : m));
    } catch (error) {
      alert('Failed to update item status');
    }
  };

  const categoryOptions = categories.map((cat) => ({
    value: cat._id === 'all' ? 'All' : cat._id,
    label: cat._id === 'all' ? 'All' : `${cat.name}${cat.menuItemCount !== undefined ? ` (${cat.menuItemCount})` : ''}`,
  }));
  const foodTypes = ['All', 'Veg', 'Non-Veg', 'Egg', 'Jain'];
  const statuses = ['All', 'Available', 'Paused', 'Draft'];

  if (loading) {
    return (
      <Layout headerProps={{ title: "Loading..." }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading menu items...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: ['Vendor', 'Delivery Staff'].includes(user?.role) && user?.outlet?.name
          ? `Menu - ${user.outlet.name}`
          : "Menu Management",
        searchPlaceholder: "Search menu items...",
        searchValue: searchTerm,
        onSearchChange: (e) => setSearchTerm(e.target.value),
        actionButton: (
          <Button onClick={() => navigate('/menu/add')}>
            <span className="material-icons-outlined text-lg">add</span>
            Add Menu Item
          </Button>
        )
      }}
    >
      <div className="p-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={categoryOptions}
            className="min-w-[150px]"
            disabled={categoriesLoading}
          />
          <Select
            value={selectedFoodType}
            onChange={(e) => setSelectedFoodType(e.target.value)}
            options={foodTypes}
            className="min-w-[150px]"
          />
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={statuses}
            className="min-w-[150px]"
          />
          <Input
            placeholder="Min Price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            type="number"
            className="w-32"
          />
          <Input
            placeholder="Max Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            type="number"
            className="w-32"
          />
          {fetching && (
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary ml-2" />
          )}
        </div>

        {/* Menu Items Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity duration-150 ${fetching ? 'opacity-60' : 'opacity-100'}`}>
          {filteredItems.map((item) => (
            <Card key={item._id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-icons-outlined text-6xl text-slate-300 dark:text-slate-700">image</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded ${item.foodType === 'Veg' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                    {item.foodType}
                  </span>
                </div>
              </div>
                <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white">{item.name}</h3>
                  <div className="flex items-center gap-2">
                    {/* Availability toggle */}
                    <button
                      onClick={() => handleToggleStatus(item)}
                      title={item.status === 'Available' ? 'Mark as Unavailable' : 'Mark as Available'}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                        item.status === 'Available' ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          item.status === 'Available' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      item.status === 'Available' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      item.status === 'Paused' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
                  {item.description || 'No description'}
                </p>
                {item.vendor?.name && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mb-2">
                    <span className="material-icons-outlined text-[14px]">storefront</span>
                    {item.vendor.name}
                  </p>
                )}
                {/* Time slot info */}
                {item.availabilityType === 'Custom Time Slots' && (
                  <div className="mb-2 space-y-0.5">
                    {item.days?.length > 0 && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="material-icons-outlined text-[13px]">calendar_today</span>
                        {item.days.join(', ')}
                      </p>
                    )}
                    {item.timeSlots?.length > 0 && (
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="material-icons-outlined text-[13px]">schedule</span>
                        {item.timeSlots.map((s) => `${s.start}–${s.end}`).join(', ')}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-bold text-primary">₹{item.basePrice || '0.00'}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/menu/edit/${item._id}`)}
                      className={`p-2 transition-colors ${item.status === 'Available' && user?.role === 'Vendor' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-primary'}`}
                      disabled={item.status === 'Available' && user?.role === 'Vendor'}
                      title={item.status === 'Available' && user?.role === 'Vendor' ? "Mark as unavailable to edit" : "Edit"}
                      aria-label="Edit"
                    >
                      <span className="material-icons-outlined text-sm">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      aria-label="Delete"
                    >
                      <span className="material-icons-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <span className="material-icons-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">restaurant_menu</span>
            <p className="text-slate-600 dark:text-slate-400">No menu items found</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MenuBrowse;
