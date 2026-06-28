import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Card from '../components/UI/Card';
import ImageUpload from '../components/ImageUpload';
import api from '../utils/api';

const AddMenuItem = () => {
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    image: null,
    foodType: 'Veg',
    status: 'Available',
    availabilityType: 'All Day',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    stockType: 'Unlimited',
    costPrice: 0,
    basePrice: 0,
    variants: [],
    promotions: {
      enabled: false,
      discount: 0,
    },
    vendor: '',
    applyToAll: true,
    outlets: []
  });

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
      if (response.data.length > 0) {
        setFormData(prev => ({ ...prev, category: response.data[0]._id }));
      }
    } catch (err) {
      setCategoriesError('Failed to load categories');
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    // Fetch outlets from API
    const fetchOutlets = async () => {
      try {
        const response = await api.get('/outlets');
        setOutlets(response.data);
        if (response.data.length > 0) {
          setFormData(prev => ({ ...prev, vendor: response.data[0]._id }));
        }
      } catch (error) {
        console.error('Error fetching outlets:', error);
      }
    };
    fetchOutlets();
    fetchCategories();
  }, []);

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

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const handleSubmit = async (isDraft = false) => {
    if (!formData.name || !formData.vendor) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
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
        stockType: formData.stockType,
        costPrice: parseFloat(formData.costPrice) || 0,
        basePrice: parseFloat(formData.basePrice) || 0,
        variants: formData.variants.filter(v => v.name && v.price),
        promotions: formData.promotions,
        vendor: formData.vendor,
        applyToAll: formData.applyToAll,
        outlets: formData.applyToAll ? [] : formData.outlets,
      };

      const response = await api.post('/menu-items', menuItemData);
      navigate('/menu/browse');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create menu item');
    } finally {
      setLoading(false);
    }
  };

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const foodTypes = ['Veg', 'Non-Veg', 'Egg', 'Jain'];

  return (
    <Layout
      headerProps={{
        title: "Add New Menu Item",
        breadcrumbs: [
          { label: 'Menu Management', path: '#' },
          { label: 'Add New Item' }
        ]
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            {/* Vendor Selection */}
            <Card>
              <Select
                label="Select Vendor"
                value={formData.vendor}
                onChange={(e) => handleInputChange('vendor', e.target.value)}
                options={outlets.map(outlet => ({ label: outlet.name, value: outlet._id }))}
                placeholder="Choose vendor"
              />
            </Card>

            {/* Target Outlets */}
            <Card title="Target Outlets">
              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.applyToAll}
                    onChange={(e) => handleInputChange('applyToAll', e.target.checked)}
                    className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Make available at all outlets (Apply to All)
                  </span>
                </label>

                {!formData.applyToAll && (
                  <div className="mt-4 space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Select Specific Outlets
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                      {outlets.map((outlet) => (
                        <label key={outlet._id} className="flex items-center space-x-3 cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                          <input
                            type="checkbox"
                            checked={formData.outlets.includes(outlet._id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updatedOutlets = checked
                                ? [...formData.outlets, outlet._id]
                                : formData.outlets.filter(id => id !== outlet._id);
                              handleInputChange('outlets', updatedOutlets);
                            }}
                            className="w-4.5 h-4.5 text-primary rounded border-slate-300 focus:ring-primary"
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-300">{outlet.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                <div>
                  <label className="block text-sm font-medium mb-3">Stock Type</label>
                  <div className="flex gap-2">
                    {['Unlimited', 'Limited per day'].map((type) => (
                      <button
                        key={type}
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
                <Button variant="ghost" onClick={addVariant}>
                  <span className="material-icons-outlined text-base mr-1">add</span>
                  Add Variant
                </Button>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Cost Price</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                      <input
                        className="w-full pl-8 pr-4 py-2 border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                        type="number"
                        step="0.01"
                        value={formData.costPrice}
                        onChange={(e) => handleInputChange('costPrice', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Selling Price (Base Price)</label>
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
                </div>
                {formData.variants.map((variant, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                    <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">
                      Variant {idx + 1}
                    </label>
                    <input
                      className="w-full px-4 py-2 border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                      placeholder="Variant name"
                      type="text"
                      value={variant.name}
                      onChange={(e) => handleVariantChange(idx, 'name', e.target.value)}
                    />
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
                  <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">Veg</span>
                  <span className="text-xs text-slate-500 font-medium">{categories.find(c => c._id === formData.category)?.name || ''}</span>
                </div>
                <h3 className="text-lg font-bold mb-1">{formData.name || 'Item Name'}</h3>
                <p className="text-sm text-slate-400 mb-6">{formData.description || 'Description will appear here...'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">₹{formData.basePrice}</span>
                  <Button>Add to Cart</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 mt-auto">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')}>
            Cancel
          </Button>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={loading}>
              {loading ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={loading}>
              {loading ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        </div>
      </footer>
    </Layout >
  );
};

export default AddMenuItem;
