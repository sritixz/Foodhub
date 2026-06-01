import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import MenuItemCard from '../components/MenuItemCard';
import Cart from '../components/Cart';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Card from '../components/UI/Card';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const OrderPlacement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const outletId = searchParams.get('outlet');
  const qrData = searchParams.get('qr');

  const [menuItems, setMenuItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFoodType, setSelectedFoodType] = useState('All');
  const [orderDetails, setOrderDetails] = useState({
    deliveryAddress: '',
    deliveryNotes: '',
    orderType: qrData ? 'QR' : 'Regular',
    deliveryMode: 'Delivery',
    scheduledTime: '',
  });

  useEffect(() => {
    fetchMenuItems();
  }, [outletId]);

  useEffect(() => {
    filterItems();
  }, [menuItems, searchTerm, selectedCategory, selectedFoodType]);

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const url = outletId
        ? `/menu-items/outlet/${outletId}`
        : '/menu-items?status=Available';
      const response = await api.get(url);
      setMenuItems(response.data);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = menuItems.filter(item => item.status === 'Available');

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (selectedFoodType !== 'All') {
      filtered = filtered.filter(item => item.foodType === selectedFoodType);
    }

    setFilteredItems(filtered);
  };

  const handleAddToCart = (item) => {
    const existingItem = cart.find(cartItem =>
      cartItem.menuItem?._id === item._id && !cartItem.variant
    );

    if (existingItem) {
      handleUpdateQuantity(cart.indexOf(existingItem), existingItem.quantity + 1);
    } else {
      setCart([...cart, {
        menuItem: item,
        quantity: 1,
        variantPrice: item.basePrice,
      }]);
    }
  };

  const handleUpdateQuantity = (index, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(index);
      return;
    }

    const updatedCart = [...cart];
    updatedCart[index].quantity = newQuantity;
    setCart(updatedCart);
  };

  const handleRemoveItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    if (orderDetails.deliveryMode === 'Delivery' && !orderDetails.deliveryAddress) {
      alert('Please provide a delivery address');
      return;
    }

    setSubmitting(true);

    try {
      // Calculate total amount
      const totalAmount = cart.reduce((sum, item) => {
        const itemPrice = item.variantPrice || item.menuItem?.basePrice || 0;
        return sum + (itemPrice * item.quantity);
      }, 0);

      // Determine delivery mode based on order type
      const deliveryMode = orderDetails.orderType === 'QR'
        ? orderDetails.deliveryMode || (orderDetails.deliveryAddress ? 'Delivery' : 'Dine-in')
        : orderDetails.deliveryMode || 'Delivery';

      // Map order type correctly
      const orderType = orderDetails.orderType === 'QR' ? 'QR' : 'Retail';

      // Prepare customer data
      const customerData = user ? {
        name: user.name || 'Guest',
        email: user.email || null,
        phone: user.phone || null,
      } : {
        name: 'Guest',
        email: null,
        phone: null,
      };

      const orderData = {
        vendor: outletId || menuItems[0]?.vendor?._id || menuItems[0]?.vendor,
        items: cart.map(item => ({
          menuItem: item.menuItem._id || item.menuItem,
          quantity: item.quantity,
          variant: item.variant || null,
          price: item.variantPrice || item.menuItem.basePrice,
        })),
        orderType: orderType,
        deliveryMode: deliveryMode,
        deliveryAddress: orderDetails.deliveryAddress,
        notes: orderDetails.deliveryNotes || null,
        scheduledTime: orderDetails.scheduledTime || null,
        customer: customerData,
        amount: totalAmount,
        status: 'New', // Backend uses 'New' not 'Pending'
      };

      const response = await api.post('/orders', orderData);
      navigate(`/orders/track/${response.data._id}`);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ['All', 'Main Course', 'Appetizers', 'Beverages', 'Desserts'];
  const foodTypes = ['All', 'Veg', 'Non-Veg', 'Egg', 'Jain'];

  if (loading) {
    return (
      <Layout headerProps={{ title: "Loading..." }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading menu...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "Place Order",
        searchPlaceholder: "Search menu items...",
        searchValue: searchTerm,
        onSearchChange: (e) => setSearchTerm(e.target.value),
      }}
    >
      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={categories}
                className="min-w-[150px]"
              />
              <Select
                value={selectedFoodType}
                onChange={(e) => setSelectedFoodType(e.target.value)}
                options={foodTypes}
                className="min-w-[150px]"
              />
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <MenuItemCard
                  key={item._id}
                  item={item}
                  onAddToCart={handleAddToCart}
                  showAddButton={true}
                />
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <span className="material-icons-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">restaurant_menu</span>
                <p className="text-slate-600 dark:text-slate-400">No menu items found</p>
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <Cart
              items={cart}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onClear={handleClearCart}
              onCheckout={handleCheckout}
            />

            {/* Order Details */}
            {cart.length > 0 && (
              <Card className="mt-6">
                <h3 className="font-bold mb-4">Order Details</h3>
                <div className="space-y-4">
                  <Select
                    label="Delivery Mode"
                    value={orderDetails.deliveryMode}
                    onChange={(e) => setOrderDetails({ ...orderDetails, deliveryMode: e.target.value })}
                    options={['Delivery', 'Pickup', 'Dine-in']}
                  />
                  <Input
                    label="Delivery Address"
                    placeholder="Enter delivery address"
                    value={orderDetails.deliveryAddress}
                    onChange={(e) => setOrderDetails({ ...orderDetails, deliveryAddress: e.target.value })}
                    disabled={orderDetails.deliveryMode !== 'Delivery'}
                  />
                  <Input
                    label="Schedule Delivery (optional)"
                    value={orderDetails.scheduledTime}
                    onChange={(e) => setOrderDetails({ ...orderDetails, scheduledTime: e.target.value })}
                    type="datetime-local"
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Delivery Notes</label>
                    <textarea
                      className="w-full px-4 py-2 border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                      placeholder="Special instructions..."
                      rows="3"
                      value={orderDetails.deliveryNotes}
                      onChange={(e) => setOrderDetails({ ...orderDetails, deliveryNotes: e.target.value })}
                    />
                  </div>
                  <Button
                    onClick={handleCheckout}
                    className="w-full"
                    disabled={submitting || (orderDetails.deliveryMode === 'Delivery' && !orderDetails.deliveryAddress)}
                  >
                    {submitting ? 'Placing Order...' : 'Place Order'}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrderPlacement;
