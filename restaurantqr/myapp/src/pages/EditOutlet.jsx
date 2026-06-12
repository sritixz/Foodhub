import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Card from '../components/UI/Card';
import ImageUpload from '../components/ImageUpload';
import Modal from '../components/UI/Modal';
import api from '../utils/api';

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const stateCityMap = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Rajahmundry', 'Kakinada', 'Kadapa', 'Anantapur'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Arrah', 'Begusarai'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar', 'Rohtak', 'Sonipat'],
  'Himachal Pradesh': ['Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi', 'Kullu'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli', 'Belgaum', 'Davangere', 'Shimoga', 'Tumkur'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Palakkad', 'Alappuzha'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Navi Mumbai'],
  'Manipur': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai', 'Nongstoin'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar', 'Bharatpur'],
  'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Mahbubnagar'],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Allahabad', 'Meerut', 'Noida', 'Ghaziabad', 'Bareilly'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Rishikesh', 'Haldwani', 'Roorkee', 'Nainital'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman', 'Kharagpur'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Silvassa', 'Daman', 'Diu'],
  'Delhi': ['New Delhi', 'Delhi'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur'],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Kavaratti'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Mahe', 'Yanam']
};

const EditOutlet = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [docViewer, setDocViewer] = useState({ open: false, url: null, loading: false });

  useEffect(() => {
    fetchOutlet();
  }, [id]);

  const fetchOutlet = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/outlets/${id}`);
      const outletData = response.data;
      setFormData({
        ...outletData,
        deliveryZonesInput: outletData.deliveryZones?.join(', ') || '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load outlet');
      console.error('Error fetching outlet:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: "Loading..." }}>
        <div className="flex items-center justify-center px-8 py-10 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading outlet...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!formData) {
    return null;
  }

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

  const openDocument = async (url) => {
    setDocViewer({ open: true, url: null, loading: true });
    try {
      const res = await api.post('/upload/presigned-url', { url });
      setDocViewer({ open: true, url: res.data.url, loading: false });
    } catch {
      // Server unavailable or presign failed — show the raw URL in iframe anyway
      // (works if bucket has public access, shows download option if not)
      setDocViewer({ open: true, url, loading: false });
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

  const handleSubmit = async () => {
    if (!formData.name || !formData.contact?.email) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let logoUrl = formData.logo;

      // Upload logo if it's a file object (new upload)
      if (formData.logo && formData.logo instanceof File) {
        const formDataUpload = new FormData();
        formDataUpload.append('logo', formData.logo);
        const uploadResponse = await api.post('/upload/outlet-logo', formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logoUrl = uploadResponse.data.url;
      }

      // Upload documents to S3 if new files selected
      const documents = { ...(formData.documents || {}) };

      if (documents.rentAgreement instanceof File) {
        const fd = new FormData();
        fd.append('document', documents.rentAgreement);
        const res = await api.post('/upload/outlet-documents', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        documents.rentAgreement = res.data.url;
      }

      if (documents.fssaiLicense instanceof File) {
        const fd = new FormData();
        fd.append('document', documents.fssaiLicense);
        const res = await api.post('/upload/outlet-documents', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        documents.fssaiLicense = res.data.url;
      }

      if (Array.isArray(documents.otherDocs)) {
        documents.otherDocs = await Promise.all(
          documents.otherDocs.map(async (f) => {
            if (f instanceof File) {
              const fd = new FormData();
              fd.append('document', f);
              const res = await api.post('/upload/outlet-documents', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              return res.data.url;
            }
            return f;
          })
        );
      }

      // Prepare outlet data for API
      const deliveryZones = Array.isArray(formData.deliveryZones)
        ? formData.deliveryZones
        : formData.deliveryZonesInput
          ? formData.deliveryZonesInput.split(',').map((zone) => zone.trim()).filter(Boolean)
          : [];

      const outletData = {
        name: formData.name,
        businessType: formData.businessType,
        fssaiLicense: formData.fssaiLicense,
        contact: {
          name: formData.contact?.name || '',
          email: formData.contact?.email || '',
          phone: formData.contact?.phone || '',
        },
        location: {
          address: formData.location?.address || '',
          state: formData.location?.state || '',
          city: formData.location?.city || '',
          zone: formData.location?.zone || '',
        },
        logo: logoUrl,
        documents,
        sales: formData.sales || {
          today: 0,
          monthly: 0,
        },
        commissionRate: Number(formData.commissionRate) || 0,
        rating: Number(formData.rating) || 0,
        deliveryFee: Number(formData.deliveryFee) || 0,
        deliveryZones: deliveryZones,
        operatingHours: {
          open: formData.operatingHours?.open || '09:00',
          close: formData.operatingHours?.close || '22:00',
        },
      };

      console.log('Sending documents:', {
        rentAgreement: documents.rentAgreement ? documents.rentAgreement.substring(0, 50) + '...' : null,
        fssaiLicense: documents.fssaiLicense ? documents.fssaiLicense.substring(0, 50) + '...' : null,
        otherDocs: documents.otherDocs?.length,
      });

      const result = await api.put(`/outlets/${id}`, outletData);
      console.log('Save result documents:', result.data?.documents);
      
      // Reload fresh data from server to confirm what was saved
      setFormData({
        ...result.data,
        deliveryZonesInput: result.data.deliveryZones?.join(', ') || '',
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to update outlet';
      setError(msg);
      console.error('Save error:', err.response?.data || err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      headerProps={{
        title: "Edit Outlet",
        breadcrumbs: [
          { label: 'Dashboard', path: '/' },
          { label: 'Vendor', path: '/' },
          { label: 'Edit Vendor' }
        ]
      }}
    >
      <div className="max-w-7xl mx-auto px-8 py-10 space-y-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {saveSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg flex items-center gap-2">
            <span className="material-icons-outlined text-sm">check_circle</span>
            Changes saved successfully!
          </div>
        )}
        {/* Business Information */}
        <Card title="Business Information">
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="flex-grow space-y-6">
              <Input
                label="Outlet Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Business Type
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleInputChange('businessType', 'Restaurant')}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${formData.businessType === 'Restaurant'
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    Restaurant
                  </button>
                  <button
                    onClick={() => handleInputChange('businessType', 'Cafe')}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${formData.businessType === 'Cafe'
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    Cafe
                  </button>
                  <button
                    onClick={() => handleInputChange('businessType', 'Bakery')}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${formData.businessType === 'Bakery'
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                  >
                    Bakery
                  </button>
                </div>
              </div>
              <Input
                label="FSSAI License Number"
                value={formData.fssaiLicense}
                onChange={(e) => handleInputChange('fssaiLicense', e.target.value)}
              />
              <div className="pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                  Contact Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Contact Person Name"
                    value={formData.contact?.name || ''}
                    onChange={(e) => handleInputChange('contact.name', e.target.value)}
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={formData.contact?.email || ''}
                    onChange={(e) => handleInputChange('contact.email', e.target.value)}
                  />
                </div>
                <div className="w-full md:w-1/2">
                  <Input
                    label="Phone Number"
                    value={formData.contact?.phone || ''}
                    onChange={(e) => handleInputChange('contact.phone', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="w-full lg:w-48 flex flex-col items-center space-y-4 pt-6 lg:pt-0">
              <ImageUpload
                label="Business Logo"
                value={formData.logo}
                onChange={(url) => handleInputChange('logo', url)}
                folder="outlet-logos"
              />
              {formData.updatedAt && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-tight text-center">
                  Last updated: {new Date(formData.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Location Setup */}
        <Card title="Outlet & Location Setup">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Select
                label="Assigned Zone"
                value={formData.location?.zone || ''}
                onChange={(e) => handleInputChange('location.zone', e.target.value)}
                options={['North Zone', 'South Zone', 'East Zone', 'West Zone']}
              />
              <Select
                label="State"
                value={formData.location?.state || ''}
                onChange={(e) => {
                  handleInputChange('location.state', e.target.value);
                  handleInputChange('location.city', '');
                }}
                options={indianStates}
              />
              <Select
                label="City"
                value={formData.location?.city || ''}
                onChange={(e) => handleInputChange('location.city', e.target.value)}
                options={formData.location?.state ? (stateCityMap[formData.location.state] || []) : []}
                placeholder={formData.location?.state ? "Select city" : "Select state first"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Head Office Address
              </label>
              <textarea
                className="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-primary focus:border-primary resize-none"
                rows="4"
                value={formData.location?.address || ''}
                onChange={(e) => handleInputChange('location.address', e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card title="Configuration">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Commission Rate (%)"
              value={formData.commissionRate || 0}
              onChange={(e) => handleInputChange('commissionRate', e.target.value)}
              type="number"
            />
            <Input
              label="Delivery Fee"
              value={formData.deliveryFee || 0}
              onChange={(e) => handleInputChange('deliveryFee', e.target.value)}
              type="number"
            />
            <Input
              label="Delivery Zones"
              placeholder="Zone A, Zone B"
              value={formData.deliveryZonesInput || ''}
              onChange={(e) => handleInputChange('deliveryZonesInput', e.target.value)}
            />
            <Input
              label="Rating (0-5)"
              value={formData.rating || 0}
              onChange={(e) => handleInputChange('rating', e.target.value)}
              type="number"
            />
            <Input
              label="Operating Hours (Open)"
              value={formData.operatingHours?.open || '09:00'}
              onChange={(e) => handleInputChange('operatingHours.open', e.target.value)}
              type="time"
            />
            <Input
              label="Operating Hours (Close)"
              value={formData.operatingHours?.close || '22:00'}
              onChange={(e) => handleInputChange('operatingHours.close', e.target.value)}
              type="time"
            />
          </div>
        </Card>

        {/* Documents */}
        <Card title="Documents">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Rent Agreement */}
            <div className="border border-slate-100 dark:border-slate-700 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Rent Agreement</p>
                  <p className="text-xs mt-0.5">
                    {formData.documents?.rentAgreement instanceof File
                      ? <span className="text-primary">{formData.documents.rentAgreement.name}</span>
                      : formData.documents?.rentAgreement
                        ? <span className="text-green-500 flex items-center gap-1"><span className="material-icons-outlined text-sm">check_circle</span>Uploaded</span>
                        : <span className="text-slate-400">No file uploaded</span>}
                  </p>
                </div>
                <label className="cursor-pointer" title="Upload new file">
                  <span className="text-primary hover:bg-orange-50 dark:hover:bg-orange-900/20 p-1.5 rounded-lg transition-colors inline-flex">
                    <span className="material-icons-outlined">upload</span>
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => handleFileChange('rentAgreement', e.target.files[0])} />
                </label>
              </div>
              {formData.documents?.rentAgreement && !(formData.documents.rentAgreement instanceof File) && (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => openDocument(formData.documents.rentAgreement)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium">
                    <span className="material-icons-outlined text-sm">visibility</span> View
                  </button>
                  <a href={formData.documents.rentAgreement} download
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium">
                    <span className="material-icons-outlined text-sm">download</span> Download
                  </a>
                </div>
              )}
            </div>

            {/* FSSAI License */}
            <div className="border border-slate-100 dark:border-slate-700 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">FSSAI License</p>
                  <p className="text-xs mt-0.5">
                    {formData.documents?.fssaiLicense instanceof File
                      ? <span className="text-primary">{formData.documents.fssaiLicense.name}</span>
                      : formData.documents?.fssaiLicense
                        ? <span className="text-green-500 flex items-center gap-1"><span className="material-icons-outlined text-sm">check_circle</span>Uploaded</span>
                        : <span className="text-slate-400">No file uploaded</span>}
                  </p>
                </div>
                <label className="cursor-pointer" title="Upload new file">
                  <span className="text-primary hover:bg-orange-50 dark:hover:bg-orange-900/20 p-1.5 rounded-lg transition-colors inline-flex">
                    <span className="material-icons-outlined">upload</span>
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => handleFileChange('fssaiLicense', e.target.files[0])} />
                </label>
              </div>
              {formData.documents?.fssaiLicense && !(formData.documents.fssaiLicense instanceof File) && (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => openDocument(formData.documents.fssaiLicense)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium">
                    <span className="material-icons-outlined text-sm">visibility</span> View
                  </button>
                  <a href={formData.documents.fssaiLicense} download
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium">
                    <span className="material-icons-outlined text-sm">download</span> Download
                  </a>
                </div>
              )}
            </div>

            {/* Other Documents */}
            <div className="border border-slate-100 dark:border-slate-700 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Other Documents</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {formData.documents?.otherDocs?.filter(f => !(f instanceof File)).length || 0} saved
                    {formData.documents?.otherDocs?.filter(f => f instanceof File).length > 0
                      ? ` · ${formData.documents.otherDocs.filter(f => f instanceof File).length} pending upload`
                      : ''}
                  </p>
                </div>
                <label className="cursor-pointer" title="Upload files">
                  <span className="text-primary hover:bg-orange-50 dark:hover:bg-orange-900/20 p-1.5 rounded-lg transition-colors inline-flex">
                    <span className="material-icons-outlined">upload</span>
                  </span>
                  <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => handleFileChange('otherDocs', Array.from(e.target.files))} />
                </label>
              </div>
              {formData.documents?.otherDocs?.filter(f => !(f instanceof File)).length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {formData.documents.otherDocs.filter(f => !(f instanceof File)).map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="material-icons-outlined text-slate-400 text-sm">insert_drive_file</span>
                      <span className="text-xs text-slate-500 truncate flex-1">Document {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => openDocument(url)}
                        className="text-primary hover:underline text-xs font-medium">View</button>
                      <a href={url} download className="text-slate-500 hover:text-slate-700 text-xs">↓</a>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </Card>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-6 pt-4 pb-12">
          <Button variant="ghost" onClick={() => navigate('/')} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Document Viewer Modal */}
      <Modal
        isOpen={docViewer.open}
        onClose={() => setDocViewer({ open: false, url: null, loading: false })}
        title="Document Viewer"
        size="lg"
      >
        {docViewer.loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="ml-3 text-slate-500">Loading document...</p>
          </div>
        ) : docViewer.url ? (
          <div className="space-y-3">
            <iframe
              src={docViewer.url}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
              style={{ height: '70vh' }}
              title="Document Preview"
              onError={() => {}}
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-400">If the document doesn't load, use the download button.</p>
              <div className="flex gap-2">
                <a
                  href={docViewer.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
                >
                  <span className="material-icons-outlined text-sm">open_in_new</span> Open in tab
                </a>
                <a
                  href={docViewer.url}
                  download
                  className="flex items-center gap-1 text-sm px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  <span className="material-icons-outlined text-sm">download</span> Download
                </a>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">Failed to load document.</p>
        )}
      </Modal>
    </Layout>
  );
};

export default EditOutlet;
