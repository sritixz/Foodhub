import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Card from '../components/UI/Card';
import ImageUpload from '../components/ImageUpload';
import api from '../utils/api';

const EditMenuItem = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [outlets, setOutlets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    image: null,
    foodType: 'Veg',
    status: 'Available',
    availabilityType: 'All Day',
    days: [],
    timeSlots: [],
    stockType: 'Unlimited',
    basePrice: 0,
    variants: [],
    promotions: {
      enabled: false,
      discount: 0,
    },
    vendor: '',
    applyToAll: false,
    outlets: []
  });

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (err) {
      setCategoriesError('Failed to load categories');
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch menu item, outlets, and categories in parallel
        const [menuResponse, outletsResponse] = await Promise.all([
          api.get(`/menu-items/${id}`),
          api.get('/outlets'),
        ]);
        const menuItem = menuResponse.data;

        setOutlets(outletsResponse.data);

        // Populate form - handle both populated category object and category ID string
        setFormData({
          name: menuItem.name || '',
          category: menuItem.category?._id || menuItem.category || '',
          description: menuItem.description || '',
          image: menuItem.image || null,
          foodType: menuItem.foodType || 'Veg',
          status: menuItem.status || 'Available',
          availabilityType: menuItem.availabilityType || 'All Day',
          days: menuItem.days || [],
          timeSlots: menuItem.timeSlots || [],
          stockType: menuItem.stockType || 'Unlimited',
          basePrice: menuItem.basePrice || 0,
          variants: menuItem.variants || [],
          promotions: menuItem.promotions || { enabled: false, discount: 0 },
          vendor: menuItem.vendor?._id || menuItem.vendor || '',
          applyToAll: false,
          outlets: []
        });
      } catch (error) {
        setError('Failed to load menu item');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
      fetchCategories();
    }
  }, [id]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVariantChange = (index, field, value) => {
    const variants = [...formData.variants];
    variants[index] = { ...variants[index], [field]: value };
    setFormData(prev => ({ ...prev, variants }));
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { name: '', price: '' }]
    }));
  };

  const removeVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const addTimeSlot = () => {
    setFormData(prev => ({ ...prev, timeSlots: [...prev.timeSlots, { start: '09:00', end: '17:00' }] }));
  };

  const removeTimeSlot = (idx) => {
    setFormData(prev => ({ ...prev, timeSlots: prev.timeSlots.filter((_, i) => i !== idx) }));
  };

  const updateTimeSlot = (idx, field, value) => {
    setFormData(prev => {
      const updated = [...prev.timeSlots];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, timeSlots: updated };
    });
  };

  const handleSubmit = async (isDraft = false) => {
    if (!formData.name || !formData.vendor) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const menuItemData = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        image: formData.image,
        foodType: formData.foodType,
        status: isDraft ? 'Draft' : formData.status,
        availabilityType: formData.availabilityType,
        days: formData.days,
        timeSlots: formData.availabilityType === 'Custom Time Slots' ? formData.timeSlots.filter(s => s.start && s.end) : [],
        stockType: formData.stockType,
        basePrice: parseFloat(formData.basePrice) || 0,
        variants: formData.variants.filter(v => v.name && v.price),
        promotions: formData.promotions,
        vendor: formData.vendor,
        applyToAll: formData.applyToAll,
        outlets: formData.applyToAll ? [] : formData.outlets,
      };

      await api.put(`/menu-items/${id}`, menuItemData);
      navigate('/menu/browse');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update menu item');
    } finally {
      setSaving(false);
    }
  };

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const foodTypes = ['Veg', 'Non-Veg', 'Egg', 'Jain'];

  if (loading) {
    return (
      <Layout headerProps={{ title: "Loading..." }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading menu item...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "Edit Menu Item",
        breadcrumbs: [
          { label: 'Menu Management', path: '/menu/browse' },
          { label: 'Edit Item' }
        ]
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            {/* Vendor Selection */}
            <Card>
              <Select
                label="Vendor/Outlet"
                value={formData.vendor}
                onChange={(e) => handleInputChange('vendor', e.target.value)}
                options={outlets.map(o => ({ value: o._id, label: o.name }))}
              />
            </Card>

            {/* Item Details */}
            <Card title="Item Details">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}
              <div className="space-y-5">
                <Input
                  label="Item Name"
                  placeholder="Enter item name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
                <Select
                  label="Category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
                  placeholder={categoriesLoading ? 'Loading categories...' : categories.length === 0 ? 'No categories available' : 'Select category'}
                  disabled={categoriesLoading}
                />
                {categoriesError && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <span>{categoriesError}</span>
                    <button
                      type="button"
                      onClick={fetchCategories}
                      className="underline hover:no-underline"
                    >
                      Retry
                    </button>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description</label>
                  <textarea
                    className="w-full px-4 py-2 border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                    placeholder="Enter item description"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                </div>
                <ImageUpload
                  label="Image"
                  value={formData.image}
                  onChange={(url) => handleInputChange('image', url)}
                  folder="menu-items"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Food Type</label>
                    <div className="flex flex-wrap gap-2">
                      {foodTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleInputChange('foodType', type)}
                          className={`flex items-center space-x-1 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${formData.foodType === type
                              ? 'border-green-500 text-green-600 bg-green-50'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                        >
                          <span className="material-icons-outlined text-sm">eco</span>
                          <span>{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Status</label>
                    <div className="flex gap-2">
                      {['Available', 'Paused', 'Draft'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleInputChange('status', status)}
                          className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${formData.status === status
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Availability Settings */}
            <Card title="Availability Settings">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">Availability Type</label>
                  <div className="flex gap-2">
                    {['All Day', 'Custom Time Slots'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInputChange('availabilityType', type)}
                        className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors ${formData.availabilityType === type
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3">Days of Availability</label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`w-12 h-10 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${formData.days.includes(day)
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-slate-200 dark:border-slate-800 text-slate-400'
                          }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                {formData.availabilityType === 'Custom Time Slots' && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium">Time Slots</label>
                      <button
                        type="button"
                        onClick={addTimeSlot}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <span className="material-icons-outlined text-sm">add</span>
                        Add Slot
                      </button>
                    </div>
                    {formData.timeSlots.length === 0 && (
                      <p className="text-xs text-slate-400 mb-2">No time slots added. Item will be available all day on selected days.</p>
                    )}
                    <div className="space-y-2">
                      {formData.timeSlots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-xs text-slate-500 font-medium w-6">{idx + 1}</span>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateTimeSlot(idx, 'start', e.target.value)}
                              className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                            <span className="text-xs text-slate-400">to</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateTimeSlot(idx, 'end', e.target.value)}
                              className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTimeSlot(idx)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <span className="material-icons-outlined text-sm">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-3">Stock Type</label>
                  <div className="flex gap-2">
                    {['Unlimited', 'Limited per day'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleInputChange('stockType', type)}
                        className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors ${formData.stockType === type
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Pricing & Variants */}
            <Card title="Pricing & Variants">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold">Pricing & Variants</h2>
                <Button variant="ghost" onClick={addVariant} type="button">
                  <span className="material-icons-outlined text-base mr-1">add</span>
                  Add Variant
                </Button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Base Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                    <input
                      className="w-full pl-8 pr-4 py-2 border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                      type="number"
                      step="0.01"
                      value={formData.basePrice}
                      onChange={(e) => handleInputChange('basePrice', e.target.value)}
                    />
                  </div>
                </div>
                {formData.variants.map((variant, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">
                        Variant {idx + 1}
                      </label>
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <span className="material-icons-outlined text-sm">delete</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        className="w-full px-4 py-2 border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                        placeholder="Variant name"
                        type="text"
                        value={variant.name || ''}
                        onChange={(e) => handleVariantChange(idx, 'name', e.target.value)}
                      />
                      <input
                        className="w-full px-4 py-2 border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                        placeholder="Price"
                        type="number"
                        step="0.01"
                        value={variant.price || ''}
                        onChange={(e) => handleVariantChange(idx, 'price', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Promotions */}
            <Card title="Promotions">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold">Promotions</h2>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.promotions.enabled}
                    onChange={(e) => handleInputChange('promotions', {
                      ...formData.promotions,
                      enabled: e.target.checked,
                    })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary" />
                </label>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start space-x-4">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="material-icons-outlined text-slate-500">sell</span>
                </div>
                <div>
                  <h3 className="font-medium">Enable offer for this item</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Add promotional offers to attract more customers
                  </p>
                </div>
              </div>
              {formData.promotions.enabled && (
                <div className="mt-4">
                  <Input
                    label="Discount (%)"
                    value={formData.promotions.discount}
                    onChange={(e) => handleInputChange('promotions', {
                      ...formData.promotions,
                      discount: e.target.value,
                    })}
                    type="number"
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-4 sticky top-6">
            <h2 className="text-lg font-bold mb-4">Preview</h2>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                {formData.image ? (
                  <img
                    src={formData.image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-icons-outlined text-6xl text-slate-300 dark:text-slate-700">image</span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`px-2 py-0.5 text-white text-[10px] font-bold rounded ${formData.foodType === 'Veg' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                    {formData.foodType}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">{categories.find(c => c._id === formData.category)?.name || formData.category}</span>
                </div>
                <h3 className="text-lg font-bold mb-1">{formData.name || 'Item Name'}</h3>
                <p className="text-sm text-slate-400 mb-6">{formData.description || 'Description will appear here...'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">₹{formData.basePrice || '0.00'}</span>
                  <Button>Add to Cart</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 mt-auto">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/menu/browse')}>
            Cancel
          </Button>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>
              {saving ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={saving}>
              {saving ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>
      </footer>
    </Layout >
  );
};

export default EditMenuItem;
