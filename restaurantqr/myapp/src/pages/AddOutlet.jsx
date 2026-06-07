import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Card from '../components/UI/Card';
import ImageUpload from '../components/ImageUpload';
import api from '../utils/api';

const AddOutlet = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState('business');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    businessType: 'Dine-In',
    fssaiLicense: '',
    contact: {
      name: '',
      email: '',
      phone: ''
    },
    location: {
      totalOutlets: '',
      zone: '',
      address: '',
      state: '',
      city: ''
    },
    documents: {
      rentAgreement: null,
      fssaiLicense: null,
      otherDocs: []
    },
    logo: null,
    sales: {
      today: 0,
      monthly: 0
    },
    commissionRate: 0,
    rating: 0,
    deliveryFee: 0,
    deliveryZonesInput: '',
    operatingHours: {
      open: '09:00',
      close: '22:00'
    }
  });

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleFileChange = (field, file) => {
    if (field === 'logo') {
      setFormData(prev => ({ ...prev, logo: file }));
    } else {
      setFormData(prev => ({
        ...prev,
        documents: {
          ...prev.documents,
          [field]: file
        }
      }));
    }
  };

  const handleSubmit = async (isDraft = false) => {
    // Validate required fields
    if (!formData.name) {
      setError('Outlet Name is required');
      return;
    }
    if (!formData.contact.email) {
      setError('Contact Email is required');
      return;
    }
    if (!formData.contact.name) {
      setError('Contact Name is required');
      return;
    }
    if (!formData.contact.phone) {
      setError('Contact Phone is required');
      return;
    }

    // Validate Location fields for final submission
    if (!isDraft) {
      if (!formData.location.zone) {
        setError('Location Zone is required');
        setActiveStep('location');
        return;
      }
      if (!formData.location.address) {
        setError('Location Address is required');
        setActiveStep('location');
        return;
      }
      if (!formData.location.state) {
        setError('Location State is required');
        setActiveStep('location');
        return;
      }
      if (!formData.location.city) {
        setError('Location City is required');
        setActiveStep('location');
        return;
      }
      if (!formData.fssaiLicense) {
        setError('FSSAI License is required');
        setActiveStep('business');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      let logoUrl = formData.logo;

      // Upload logo if it's a file object
      if (formData.logo && formData.logo instanceof File) {
        const formDataUpload = new FormData();
        formDataUpload.append('logo', formData.logo);
        const uploadResponse = await api.post('/upload/outlet-logo', formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logoUrl = uploadResponse.data.url;
      }

      // Handle document uploads via S3
      const fileToBase64 = (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      const documents = { ...formData.documents };

      if (formData.documents.rentAgreement instanceof File) {
        const fd = new FormData();
        fd.append('document', formData.documents.rentAgreement);
        const res = await api.post('/upload/outlet-documents', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        documents.rentAgreement = res.data.url;
      }

      if (formData.documents.fssaiLicense instanceof File) {
        const fd = new FormData();
        fd.append('document', formData.documents.fssaiLicense);
        const res = await api.post('/upload/outlet-documents', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        documents.fssaiLicense = res.data.url;
      }

      // Other docs (multiple)
      if (Array.isArray(formData.documents.otherDocs)) {
        documents.otherDocs = await Promise.all(
          formData.documents.otherDocs.map(async (file) => {
            if (file instanceof File) {
              const fd = new FormData();
              fd.append('document', file);
              const res = await api.post('/upload/outlet-documents', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              return res.data.url;
            }
            return file;
          })
        );
      }

      // Prepare outlet data for API
      const deliveryZones = formData.deliveryZonesInput
        ? formData.deliveryZonesInput.split(',').map((zone) => zone.trim()).filter(Boolean)
        : [];

      const outletData = {
        name: formData.name,
        businessType: formData.businessType,
        fssaiLicense: formData.fssaiLicense,
        contact: {
          name: formData.contact.name,
          email: formData.contact.email,
          phone: formData.contact.phone,
        },
        location: {
          address: formData.location.address,
          state: formData.location.state,
          city: formData.location.city,
          zone: formData.location.zone,
          totalOutlets: Number(formData.location.totalOutlets) || 1,
        },
        documents: documents,
        logo: logoUrl,
        sales: {
          today: formData.sales.today || 0,
          monthly: formData.sales.monthly || 0,
        },
        commissionRate: Number(formData.commissionRate) || 0,
        rating: Number(formData.rating) || 0,
        deliveryFee: Number(formData.deliveryFee) || 0,
        deliveryZones: deliveryZones,
        operatingHours: {
          open: formData.operatingHours.open || '09:00',
          close: formData.operatingHours.close || '22:00',
        },
      };

      const response = await api.post('/outlets', outletData);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create outlet');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 'business', label: 'Business Information', icon: 'person_outline' },
    { id: 'location', label: 'Outlet & Location', icon: 'location_on' },
    { id: 'config', label: 'Configuration', icon: 'settings' },
    { id: 'documents', label: 'Documents', icon: 'description' }
  ];

  return (
    <Layout
      headerProps={{
        title: "Add New Outlet",
        breadcrumbs: [
          { label: 'Dashboard', path: '/' },
          { label: 'Outlet', path: '/' },
          { label: 'Add New' }
        ]
      }}
    >
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {/* Step Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors rounded-lg whitespace-nowrap ${activeStep === step.id
                ? 'bg-orange-50 dark:bg-primary/10 text-primary border border-orange-100 dark:border-primary/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary border border-transparent'
                }`}
            >
              <span className="material-icons-outlined text-sm">{step.icon}</span>
              {step.label}
            </button>
          ))}
        </div>

        {/* Business Information */}
        {activeStep === 'business' && (
          <Card title="Business Information">
            <div className="space-y-6">
              <Input
                label="Outlet Name"
                placeholder="Enter vendor name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">
                  Business Type
                </label>
                <div className="flex gap-4">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="biz_type"
                      className="sr-only peer"
                      checked={formData.businessType === 'Dine-In'}
                      onChange={() => handleInputChange('businessType', 'Dine-In')}
                    />
                    <div className="flex items-center justify-center gap-2 p-3 border-2 rounded-lg border-slate-200 dark:border-slate-700 peer-checked:border-primary peer-checked:bg-orange-50 dark:peer-checked:bg-primary/10 transition-all">
                      <span className="material-icons-outlined text-primary">restaurant</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Dine-In</span>
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="biz_type"
                      className="sr-only peer"
                      checked={formData.businessType === 'Delivery-Only'}
                      onChange={() => handleInputChange('businessType', 'Delivery-Only')}
                    />
                    <div className="flex items-center justify-center gap-2 p-3 border-2 rounded-lg border-slate-200 dark:border-slate-700 peer-checked:border-primary peer-checked:bg-orange-50 dark:peer-checked:bg-primary/10 transition-all">
                      <span className="material-icons-outlined text-slate-500">local_shipping</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Delivery-Only</span>
                    </div>
                  </label>
                </div>
              </div>
              <Input
                label="FSSAI License"
                placeholder="Enter FSSAI number"
                value={formData.fssaiLicense}
                onChange={(e) => handleInputChange('fssaiLicense', e.target.value)}
                className="w-1/2"
              />
              <ImageUpload
                label="Business Logo"
                value={formData.logo}
                onChange={(url) => handleInputChange('logo', url)}
                folder="outlet-logos"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input
                  label="Contact Person Name"
                  placeholder="Enter name"
                  value={formData.contact.name}
                  onChange={(e) => handleInputChange('contact.name', e.target.value)}
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="Enter email"
                  value={formData.contact.email}
                  onChange={(e) => handleInputChange('contact.email', e.target.value)}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.contact.phone}
                  onChange={(e) => handleInputChange('contact.phone', e.target.value)}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Location Setup */}
        {activeStep === 'location' && (
          <Card title="Outlet & Location Setup">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Total Number of Outlets"
                  type="number"
                  placeholder="Enter Number of outlets"
                  value={formData.location.totalOutlets}
                  onChange={(e) => handleInputChange('location.totalOutlets', e.target.value)}
                />
                <Select
                  label="Zone Assignment"
                  value={formData.location.zone}
                  onChange={(e) => handleInputChange('location.zone', e.target.value)}
                  options={['North Zone', 'South Zone', 'East Zone', 'West Zone']}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                  Head Office Address
                </label>
                <textarea
                  className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-transparent focus:border-primary focus:ring-primary px-4 py-2"
                  placeholder="Enter complete address"
                  rows="4"
                  value={formData.location.address}
                  onChange={(e) => handleInputChange('location.address', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  label="State"
                  value={formData.location.state}
                  onChange={(e) => handleInputChange('location.state', e.target.value)}
                  options={['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu']}
                  placeholder="Select state"
                />
                <Select
                  label="City"
                  value={formData.location.city}
                  onChange={(e) => handleInputChange('location.city', e.target.value)}
                  options={['Mumbai', 'Pune', 'Bangalore', 'Chennai']}
                  placeholder="Select city"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Configuration */}
        {activeStep === 'config' && (
          <Card title="Configuration">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Commission Rate (%)"
                placeholder="Enter commission rate"
                value={formData.commissionRate}
                onChange={(e) => handleInputChange('commissionRate', e.target.value)}
                type="number"
              />
              <Input
                label="Delivery Fee"
                placeholder="Enter delivery fee"
                value={formData.deliveryFee}
                onChange={(e) => handleInputChange('deliveryFee', e.target.value)}
                type="number"
              />
              <Input
                label="Delivery Zones"
                placeholder="Zone A, Zone B"
                value={formData.deliveryZonesInput}
                onChange={(e) => handleInputChange('deliveryZonesInput', e.target.value)}
              />
              <Input
                label="Rating (0-5)"
                placeholder="Enter rating"
                value={formData.rating}
                onChange={(e) => handleInputChange('rating', e.target.value)}
                type="number"
              />
              <Input
                label="Operating Hours (Open)"
                value={formData.operatingHours.open}
                onChange={(e) => handleInputChange('operatingHours.open', e.target.value)}
                type="time"
              />
              <Input
                label="Operating Hours (Close)"
                value={formData.operatingHours.close}
                onChange={(e) => handleInputChange('operatingHours.close', e.target.value)}
                type="time"
              />
            </div>
          </Card>
        )}

        {/* Documents */}
        {activeStep === 'documents' && (
          <Card title="Document Uploads">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium">Rent Agreement</span>
                  <span className="text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded uppercase font-bold">
                    Required
                  </span>
                </div>
                <label className="group cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg py-8 hover:border-primary hover:bg-orange-50 dark:hover:bg-primary/5 transition-all">
                  <span className="material-icons-outlined text-slate-400 group-hover:text-primary mb-2">upload</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {formData.documents.rentAgreement ? formData.documents.rentAgreement.name : 'Click to upload'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => handleFileChange('rentAgreement', e.target.files[0])}
                  />
                </label>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium">FSSAI License</span>
                  <span className="text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded uppercase font-bold">
                    Required
                  </span>
                </div>
                <label className="group cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg py-8 hover:border-primary hover:bg-orange-50 dark:hover:bg-primary/5 transition-all">
                  <span className="material-icons-outlined text-slate-400 group-hover:text-primary mb-2">upload</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {formData.documents.fssaiLicense ? formData.documents.fssaiLicense.name : 'Click to upload'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => handleFileChange('fssaiLicense', e.target.files[0])}
                  />
                </label>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium">Other docs</span>
                </div>
                <label className="group cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg py-8 hover:border-primary hover:bg-orange-50 dark:hover:bg-primary/5 transition-all">
                  <span className="material-icons-outlined text-slate-400 group-hover:text-primary mb-2">upload</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Click to upload</span>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => handleFileChange('otherDocs', Array.from(e.target.files))}
                  />
                </label>
              </div>
            </div>
          </Card>
        )}

        {/* Footer Actions */}
        <footer className="fixed bottom-0 left-0 md:left-72 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 px-8 flex justify-end items-center gap-4 z-20">
          <Button variant="ghost" onClick={() => navigate('/')} disabled={loading}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={loading}>
            {loading ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={loading}>
            {loading ? 'Creating...' : 'Complete Onboarding'}
          </Button>
        </footer>
      </div>
    </Layout>
  );
};

export default AddOutlet;
