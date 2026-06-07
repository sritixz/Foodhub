import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import MenuItemCard from '../components/MenuItemCard';
import Cart from '../components/Cart';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';

// Standalone public API — no auth interceptors, no login redirects
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

const QRMenu = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qrData = searchParams.get('qr');

  const [outlet, setOutlet] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    deliveryNotes: '',
    deliveryMode: 'Dine-in',
    scheduledTime: '',
  });

  const outletIdParam = searchParams.get('outlet');

  useEffect(() => {
    if (qrData) {
      fetchQRData();
    } else if (outletIdParam) {
      fetchOutletData(outletIdParam);
    }
  }, [qrData, outletIdParam]);

  useEffect(() => {
    filterItems();
  }, [menuItems, selectedCategory]);

  const fetchQRData = async () => {
    try {
      setLoading(true);
      const qrResponse = await publicApi.get(`/qrcode/scan/${qrData}`);
      setOutlet(qrResponse.data.outlet);
      const items = qrResponse.data.menuItems || [];
      setMenuItems(items);
      buildCategories(items);
    } catch (error) {
      console.error('Error fetching QR data:', error);
      alert('Invalid QR code');
      navigate('/qr/scan');
    } finally {
      setLoading(false);
    }
  };

  const fetchOutletData = async (id) => {
    try {
      setLoading(true);

      try {
        const outletRes = await publicApi.get(`/outlets/${id}`);
        setOutlet(outletRes.data);
      } catch (e) {
        console.log('Could not fetch specific outlet details, falling back');
        setOutlet({ _id: id, name: 'Menu' });
      }

      const menuResponse = await publicApi.get(`/menu-items/outlet/${id}`);
      const items = menuResponse.data || [];
      setMenuItems(items);
      buildCategories(items);

    } catch (error) {
      console.error('Error fetching menu:', error);
      alert('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const buildCategories = (items) => {
    const cats = ['All'];
    items.forEach(item => {
      const catName = item.category?.name || item.category;
      if (catName && !cats.includes(catName)) cats.push(catName);
    });
    setCategories(cats);
  };

  const filterItems = () => {
    const now = new Date();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayLabel = dayMap[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let filtered = menuItems.filter((item) => {
      if (item.status !== 'Available') return false;
      if (item.availabilityType === 'Custom Time Slots') {
        if (item.days?.length > 0 && !item.days.includes(todayLabel)) return false;
        if (item.timeSlots?.length > 0) {
          const inSlot = item.timeSlots.some((slot) => {
            if (!slot.start || !slot.end) return true;
            const [sh, sm] = slot.start.split(':').map(Number);
            const [eh, em] = slot.end.split(':').map(Number);
            return currentMinutes >= sh * 60 + sm && currentMinutes <= eh * 60 + em;
          });
          if (!inSlot) return false;
        }
      }
      return true;
    });

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => {
        const catName = item.category?.name || item.category;
        return catName === selectedCategory;
      });
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

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setSubmitting(true);

    try {
      const totalAmount = cart.reduce((sum, item) => {
        const itemPrice = item.variantPrice || item.menuItem?.basePrice || 0;
        return sum + (itemPrice * item.quantity);
      }, 0);

      const deliveryMode = orderDetails.deliveryMode || (
        orderDetails.deliveryAddress
          ? (orderDetails.deliveryAddress.includes('Table') ? 'Dine-in' : 'Delivery')
          : 'Dine-in'
      );

      const orderData = {
        vendor: outlet?._id,
        items: cart.map(item => ({
          menuItem: item.menuItem._id || item.menuItem,
          quantity: item.quantity,
          variant: item.variant || null,
          price: item.variantPrice || item.menuItem.basePrice,
        })),
        orderType: 'QR',
        deliveryMode: deliveryMode,
        deliveryAddress: orderDetails.deliveryAddress || null,
        notes: orderDetails.deliveryNotes || null,
        scheduledTime: orderDetails.scheduledTime || null,
        customer: {
          name: orderDetails.customerName || 'Guest',
          phone: orderDetails.customerPhone || null,
          email: null,
        },
        amount: totalAmount,
        status: 'New',
      };

      const response = await publicApi.post('/orders', orderData);
      navigate(`/orders/track/${response.data._id}`);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => {
    const itemPrice = item.variantPrice || item.menuItem?.basePrice || 0;
    return sum + (itemPrice * item.quantity);
  }, 0);

  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-24 lg:pb-0 font-sans">
      {/* Branded Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                {outlet?.logo ? (
                  <img src={outlet.logo} alt="Logo" className="w-12 h-12 object-contain" />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg">
                    <span className="material-icons-outlined text-primary text-2xl">restaurant</span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">
                  {outlet?.name || 'Restaurant'}
                </h1>
                <p className="text-xs font-bold text-slate-500 tracking-wider mt-1 uppercase">
                  MY OFFICE PANTRY
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/qr/scan')}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-icons-outlined text-xl">qr_code_scanner</span>
            </button>
          </div>
        </div>

        {/* Category Navigation Pills */}
        <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md overflow-x-auto no-scrollbar border-t border-slate-100 dark:border-slate-800">
          <div className="flex space-x-3 max-w-7xl mx-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-200 border-2 ${selectedCategory === cat
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 transform scale-105'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Menu Items */}
          <div className="lg:col-span-3 space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-px bg-slate-200 flex-1"></div>
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">{selectedCategory}</h2>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredItems.map((item) => (
                <div key={item._id} className="group relative">
                  <MenuItemCard
                    item={item}
                    onAddToCart={handleAddToCart}
                    showAddButton={true}
                  />
                  {/* Styling the price badge within the card via CSS in parent or better, customize the card */}
                  <div className="absolute top-4 left-4 bg-primary text-white px-3 py-1 rounded-lg font-black text-sm shadow-lg z-10 pointer-events-none">
                    ₹{item.basePrice}
                  </div>
                </div>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-sm">
                  <span className="material-icons-outlined text-5xl text-slate-300">restaurant_menu</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">Wait for it...</h3>
                <p className="text-slate-500 mt-2 max-w-xs">Nothing available in this category at the moment.</p>
              </div>
            )}
          </div>

          {/* Desktop Sidebar Cart */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-44">
              <Cart
                items={cart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                className="shadow-xl rounded-2xl border-2 border-slate-100 mb-6"
              />
              {cart.length > 0 && (
                <div className="mt-6 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 p-6 shadow-xl">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-icons-outlined text-primary">receipt_long</span>
                    <h3 className="font-black text-sm uppercase tracking-widest text-slate-700">Order Summary</h3>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <Input
                        label="Full Name"
                        placeholder="Enter your name"
                        value={orderDetails.customerName}
                        onChange={(e) => setOrderDetails({ ...orderDetails, customerName: e.target.value })}
                        className="text-sm border-slate-200 font-bold"
                      />
                      <Input
                        label="Phone Number"
                        placeholder="Enter phone number"
                        value={orderDetails.customerPhone}
                        onChange={(e) => setOrderDetails({ ...orderDetails, customerPhone: e.target.value })}
                        className="text-sm border-slate-200 font-bold"
                      />
                    </div>
                    <Select
                      label="Dining Mode"
                      value={orderDetails.deliveryMode}
                      onChange={(e) => setOrderDetails({ ...orderDetails, deliveryMode: e.target.value })}
                      options={['Dine-in', 'Delivery', 'Pickup']}
                      className="text-sm border-slate-200 font-bold"
                    />
                    <Input
                      label="Table / Location"
                      placeholder="e.g. Table 5"
                      value={orderDetails.deliveryAddress}
                      onChange={(e) => setOrderDetails({ ...orderDetails, deliveryAddress: e.target.value })}
                      className="text-sm border-slate-200 font-bold"
                    />
                    <Input
                      label="Special Instructions"
                      placeholder="e.g. No onions"
                      value={orderDetails.deliveryNotes}
                      onChange={(e) => setOrderDetails({ ...orderDetails, deliveryNotes: e.target.value })}
                      className="text-sm border-slate-200 font-bold"
                    />
                    <Button onClick={handleCheckout} className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-black text-lg shadow-xl shadow-primary/20 transition-all active:scale-95" disabled={submitting}>
                      {submitting ? 'PROCESSING...' : `PAY ₹${cartTotal.toFixed(2)}`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Cart Summary Bar - Red Styled */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-40 lg:hidden">
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto bg-primary p-3 rounded-2xl shadow-xl shadow-primary/20">
            <div onClick={() => setIsMobileCartOpen(true)} className="flex-1 cursor-pointer pl-4 text-white">
              <p className="text-[10px] uppercase font-black tracking-widest opacity-80">{cartItemCount} Items Selected</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-xl font-black">₹{cartTotal.toFixed(2)}</h3>
              </div>
            </div>
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="bg-white text-primary px-6 py-3 rounded-xl font-black uppercase text-sm shadow-lg active:scale-95 transition-all"
            >
              View Order
            </button>
          </div>
        </div>
      )}

      {/* Mobile Cart Modal (Sheet) */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileCartOpen(false)} />
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md h-[90vh] sm:h-auto sm:max-h-[90vh] sm:rounded-3xl rounded-t-[3rem] shadow-2xl flex flex-col relative z-10 transition-transform transform translate-y-0">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2" onClick={() => setIsMobileCartOpen(false)}></div>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h2 className="font-black text-xl uppercase tracking-widest text-primary">My Order</h2>
              <button onClick={() => setIsMobileCartOpen(false)} className="p-2 bg-slate-100 rounded-full transition-colors">
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <Cart
                items={cart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                className="shadow-none p-0 !bg-transparent"
              />

              <div className="mt-10 space-y-6 pt-6 border-t-2 border-dashed border-slate-100">
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">Order Details</h3>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4">
                    <Input
                      label="Full Name"
                      placeholder="Enter your name"
                      value={orderDetails.customerName}
                      onChange={(e) => setOrderDetails({ ...orderDetails, customerName: e.target.value })}
                      className="font-bold"
                    />
                    <Input
                      label="Phone Number"
                      placeholder="Enter phone number"
                      value={orderDetails.customerPhone}
                      onChange={(e) => setOrderDetails({ ...orderDetails, customerPhone: e.target.value })}
                      className="font-bold"
                    />
                  </div>
                  <Select
                    label="Dining Mode"
                    value={orderDetails.deliveryMode}
                    onChange={(e) => setOrderDetails({ ...orderDetails, deliveryMode: e.target.value })}
                    options={['Dine-in', 'Delivery', 'Pickup']}
                    className="font-bold"
                  />
                  <Input
                    label="Table / Location"
                    placeholder="e.g. Table 5"
                    value={orderDetails.deliveryAddress}
                    onChange={(e) => setOrderDetails({ ...orderDetails, deliveryAddress: e.target.value })}
                    className="font-bold"
                  />
                  <Input
                    label="Instructions"
                    placeholder="Spicy, less salt, etc."
                    value={orderDetails.deliveryNotes}
                    onChange={(e) => setOrderDetails({ ...orderDetails, deliveryNotes: e.target.value })}
                    className="font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
              <Button onClick={handleCheckout} className="w-full py-4 text-xl bg-primary hover:bg-primary/90 font-black shadow-xl shadow-primary/20 rounded-2xl" disabled={submitting}>
                {submitting ? 'SENDING...' : `PLACE ORDER • ₹${cartTotal.toFixed(2)}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRMenu;
