import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import MenuItemCard from '../components/MenuItemCard';
import Cart from '../components/Cart';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Card from '../components/UI/Card';
import Modal from '../components/UI/Modal';
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
  const [errors, setErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantItem, setVariantItem] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
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
      filtered = filtered.filter(item => {
        const catName = item.category?.name || item.category;
        return catName === selectedCategory;
      });
    }

    if (selectedFoodType !== 'All') {
      filtered = filtered.filter(item => item.foodType === selectedFoodType);
    }

    setFilteredItems(filtered);
  };

  const handleAddToCart = (item) => {
    // If item has variants, show variant selection modal
    if (item.variants && item.variants.length > 0) {
      setVariantItem(item);
      setSelectedVariant(null);
      setShowVariantModal(true);
      return;
    }

    const existingIndex = cart.findIndex(cartItem =>
      cartItem.menuItem?._id === item._id && !cartItem.variant
    );

    if (existingIndex !== -1) {
      handleUpdateQuantity(existingIndex, cart[existingIndex].quantity + 1);
    } else {
      setCart([...cart, {
        menuItem: item,
        quantity: 1,
        variant: null,
        variantPrice: item.basePrice,
      }]);
    }
    // Clear cart error when item added
    setErrors(prev => ({ ...prev, cart: '' }));
  };

  const handleAddVariantToCart = () => {
    if (!variantItem || !selectedVariant) return;

    const existingIndex = cart.findIndex(cartItem =>
      cartItem.menuItem?._id === variantItem._id && cartItem.variant === selectedVariant.name
    );

    if (existingIndex !== -1) {
      handleUpdateQuantity(existingIndex, cart[existingIndex].quantity + 1);
    } else {
      setCart([...cart, {
        menuItem: variantItem,
        quantity: 1,
        variant: selectedVariant.name,
        variantPrice: selectedVariant.price,
      }]);
    }

    setShowVariantModal(false);
    setVariantItem(null);
    setSelectedVariant(null);
    setErrors(prev => ({ ...prev, cart: '' }));
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

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const itemPrice = item.variantPrice || item.menuItem?.basePrice || 0;
      return sum + (itemPrice * item.quantity);
    }, 0);
  };

  const validateOrder = () => {
    const newErrors = {};

    if (cart.length === 0) {
      newErrors.cart = 'Your cart is empty. Add items to place an order.';
    }

    if (orderDetails.deliveryMode === 'Delivery' && !orderDetails.deliveryAddress.trim()) {
      newErrors.deliveryAddress = 'Delivery address is required';
    }

    if (orderDetails.scheduledTime) {
      const scheduled = new Date(orderDetails.scheduledTime);
      if (scheduled <= new Date()) {
        newErrors.scheduledTime = 'Scheduled time must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCheckout = () => {
    if (!validateOrder()) return;
    setShowConfirmModal(true);
  };

  const handleConfirmOrder = async () => {
    setSubmitting(true);
    setErrors({});

    try {
      const totalAmount = calculateTotal();

      const deliveryMode = orderDetails.orderType === 'QR'
        ? orderDetails.deliveryMode || (orderDetails.deliveryAddress ? 'Delivery' : 'Dine-in')
        : orderDetails.deliveryMode || 'Delivery';

      const orderType = orderDetails.orderType === 'QR' ? 'QR' : 'Retail';

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
        orderType,
        deliveryMode,
        deliveryAddress: orderDetails.deliveryAddress || null,
        notes: orderDetails.deliveryNotes || null,
        scheduledTime: orderDetails.scheduledTime || null,
        customer: customerData,
        amount: totalAmount,
        status: 'New',
      };

      const response = await api.post('/orders', orderData);
      setShowConfirmModal(false);
      navigate(`/orders/track/${response.data._id}`);
    } catch (error) {
      setErrors({ submit: error.response?.data?.message || 'Failed to place order. Please try again.' });
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
        {/* Global error */}
        {errors.submit && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
              <span className="material-icons-outlined text-sm">error</span>
              {errors.submit}
            </p>
          </div>
        )}

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

            {/* Cart error */}
            {errors.cart && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-yellow-700 dark:text-yellow-400 text-sm">{errors.cart}</p>
              </div>
            )}

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
                    onChange={(e) => {
                      setOrderDetails({ ...orderDetails, deliveryMode: e.target.value });
                      if (e.target.value !== 'Delivery') {
                        setErrors(prev => ({ ...prev, deliveryAddress: '' }));
                      }
                    }}
                    options={['Delivery', 'Pickup', 'Dine-in']}
                  />
                  <div>
                    <Input
                      label="Delivery Address"
                      placeholder="Enter delivery address"
                      value={orderDetails.deliveryAddress}
                      onChange={(e) => {
                        setOrderDetails({ ...orderDetails, deliveryAddress: e.target.value });
                        if (e.target.value.trim()) {
                          setErrors(prev => ({ ...prev, deliveryAddress: '' }));
                        }
                      }}
                      disabled={orderDetails.deliveryMode !== 'Delivery'}
                    />
                    {errors.deliveryAddress && (
                      <p className="text-red-500 text-xs mt-1">{errors.deliveryAddress}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      label="Schedule Delivery (optional)"
                      value={orderDetails.scheduledTime}
                      onChange={(e) => {
                        setOrderDetails({ ...orderDetails, scheduledTime: e.target.value });
                        setErrors(prev => ({ ...prev, scheduledTime: '' }));
                      }}
                      type="datetime-local"
                    />
                    {errors.scheduledTime && (
                      <p className="text-red-500 text-xs mt-1">{errors.scheduledTime}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Delivery Notes</label>
                    <textarea
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                      placeholder="Special instructions..."
                      rows="3"
                      value={orderDetails.deliveryNotes}
                      onChange={(e) => setOrderDetails({ ...orderDetails, deliveryNotes: e.target.value })}
                    />
                  </div>
                  <Button
                    onClick={handleCheckout}
                    className="w-full"
                    disabled={submitting}
                  >
                    Review Order
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Order Confirmation Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm Your Order" size="md">
        <div className="space-y-6">
          {/* Order Summary */}
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Order Items</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {cart.map((item, index) => {
                const price = item.variantPrice || item.menuItem?.basePrice || 0;
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{item.menuItem?.name}</p>
                      {item.variant && <p className="text-xs text-slate-500">{item.variant}</p>}
                      <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium text-sm">₹{(price * item.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Info */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Delivery Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Mode</span>
                <span className="font-medium">{orderDetails.deliveryMode}</span>
              </div>
              {orderDetails.deliveryMode === 'Delivery' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Address</span>
                  <span className="font-medium text-right max-w-[200px]">{orderDetails.deliveryAddress}</span>
                </div>
              )}
              {orderDetails.scheduledTime && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled</span>
                  <span className="font-medium">{new Date(orderDetails.scheduledTime).toLocaleString()}</span>
                </div>
              )}
              {orderDetails.deliveryNotes && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Notes</span>
                  <span className="font-medium text-right max-w-[200px]">{orderDetails.deliveryNotes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-between">
            <span className="text-lg font-bold">Total</span>
            <span className="text-xl font-bold text-primary">₹{calculateTotal().toFixed(2)}</span>
          </div>

          {/* Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 !bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-300"
              disabled={submitting}
            >
              Back to Cart
            </Button>
            <Button
              onClick={handleConfirmOrder}
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? 'Placing Order...' : 'Confirm & Place Order'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Variant Selection Modal */}
      <Modal isOpen={showVariantModal} onClose={() => setShowVariantModal(false)} title="Select Variant" size="sm">
        {variantItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              {variantItem.image && (
                <img src={variantItem.image} alt={variantItem.name} className="w-16 h-16 object-cover rounded" />
              )}
              <div>
                <h4 className="font-bold">{variantItem.name}</h4>
                <p className="text-sm text-slate-500">Base price: ₹{variantItem.basePrice}</p>
              </div>
            </div>

            {/* Base option */}
            <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="variant"
                  checked={selectedVariant === null}
                  onChange={() => setSelectedVariant(null)}
                  className="text-primary"
                />
                <span className="font-medium text-sm">Regular (Base)</span>
              </div>
              <span className="font-medium text-sm">₹{variantItem.basePrice}</span>
            </label>

            {/* Variant options */}
            {variantItem.variants.map((variant, idx) => (
              <label key={idx} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="variant"
                    checked={selectedVariant?.name === variant.name}
                    onChange={() => setSelectedVariant(variant)}
                    className="text-primary"
                  />
                  <span className="font-medium text-sm">{variant.name}</span>
                </div>
                <span className="font-medium text-sm">₹{variant.price}</span>
              </label>
            ))}

            <Button
              onClick={() => {
                if (selectedVariant) {
                  handleAddVariantToCart();
                } else {
                  // Add base item
                  const existingIndex = cart.findIndex(cartItem =>
                    cartItem.menuItem?._id === variantItem._id && !cartItem.variant
                  );
                  if (existingIndex !== -1) {
                    handleUpdateQuantity(existingIndex, cart[existingIndex].quantity + 1);
                  } else {
                    setCart([...cart, {
                      menuItem: variantItem,
                      quantity: 1,
                      variant: null,
                      variantPrice: variantItem.basePrice,
                    }]);
                  }
                  setShowVariantModal(false);
                  setVariantItem(null);
                  setErrors(prev => ({ ...prev, cart: '' }));
                }
              }}
              className="w-full"
            >
              Add to Cart
            </Button>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default OrderPlacement;
