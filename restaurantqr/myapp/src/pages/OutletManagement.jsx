import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import api from '../utils/api';

const OutletManagement = () => {
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // QR Code Modal State
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/outlets');
      setOutlets(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load outlets');
      console.error('Error fetching outlets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this outlet?')) {
      try {
        await api.delete(`/outlets/${id}`);
        setOutlets(outlets.filter(outlet => outlet._id !== id));
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete outlet');
      }
    }
  };

  const openQRModal = async (outlet) => {
    setSelectedOutlet(outlet);
    setQrModalOpen(true);

    // Fetch existing QR code
    try {
      const response = await api.get(`/qrcode/outlet/${outlet._id}`);
      if (response.data && response.data.length > 0) {
        setQrCode(response.data[0]);
      } else {
        setQrCode(null);
      }
    } catch (err) {
      console.error('Error fetching QR code:', err);
      setQrCode(null);
    }
  };

  const handleGenerateQR = async () => {
    if (!selectedOutlet) return;

    try {
      setGenerating(true);
      const response = await api.post(`/qrcode/outlet/${selectedOutlet._id}`, {});
      setQrCode(response.data.qrCode);
      alert('QR Code generated successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate QR code');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCode?.qrCodeImage) return;

    const link = document.createElement('a');
    link.href = qrCode.qrCodeImage;
    link.download = `QR_${selectedOutlet.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOutlets = outlets.filter(outlet =>
    outlet.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    outlet.outletId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: "Outlet Management" }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading outlets...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "Outlet Management",
        searchPlaceholder: "Search outlets...",
        searchValue: searchTerm,
        onSearchChange: handleSearch,
        actionButton: (
          <Button onClick={() => navigate('/outlets/add')}>
            <span className="material-icons-outlined text-lg">add</span>
            Add Outlet
          </Button>
        ),
      }}
    >
      <div className="space-y-8 w-full">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Outlets Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-8 py-4">Outlet Name</th>
                  <th className="px-8 py-4">Outlet ID</th>
                  <th className="px-8 py-4">Today Sales</th>
                  <th className="px-8 py-4">Monthly Sales</th>
                  <th className="px-8 py-4">Ordering Link</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOutlets.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-12 text-center text-slate-500 dark:text-slate-400">
                      No outlets found
                    </td>
                  </tr>
                ) : (
                  filteredOutlets.map((outlet) => (
                    <tr
                      key={outlet._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-8 py-5">
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100">{outlet.name}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            FSSAI License: {outlet.fssaiLicense || 'N/A'}
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {outlet.outletId}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          ₹{outlet.sales?.today?.toLocaleString() || '0'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          ₹{outlet.sales?.monthly?.toLocaleString() || '0'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openQRModal(outlet)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 border-2 border-primary/30 rounded-xl text-white hover:shadow-lg hover:shadow-primary/30 transition-all font-bold text-sm transform hover:scale-105"
                            title="View QR Code & Ordering Link"
                          >
                            <span className="material-icons-outlined text-lg">qr_code_2</span>
                            <span>QR Code</span>
                          </button>
                          <button
                            onClick={async () => {
                              const link = outlet.qrCodeUrl || `${window.location.origin}/qr/menu?outlet=${outlet._id}`;
                              try {
                                if (navigator.clipboard && window.isSecureContext) {
                                  await navigator.clipboard.writeText(link);
                                } else {
                                  const textArea = document.createElement('textarea');
                                  textArea.value = link;
                                  textArea.style.position = 'fixed';
                                  textArea.style.left = '-9999px';
                                  document.body.appendChild(textArea);
                                  textArea.focus();
                                  textArea.select();
                                  document.execCommand('copy');
                                  document.body.removeChild(textArea);
                                }
                                alert('Ordering link copied to clipboard!');
                              } catch (err) {
                                console.error('Copy failed:', err);
                                alert('Failed to copy. Please copy manually: ' + link);
                              }
                            }}
                            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary rounded-lg transition-all border border-slate-200 dark:border-slate-700 hover:border-primary/30"
                            title="Copy ordering link"
                          >
                            <span className="material-icons-outlined text-lg">content_copy</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            className="p-2 text-slate-400 hover:text-primary dark:hover:text-primary transition-colors"
                            onClick={() => navigate(`/outlets/view/${outlet._id}`)}
                          >
                            <span className="material-icons-outlined">visibility</span>
                          </button>
                          <button
                            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            onClick={() => navigate(`/outlets/edit/${outlet._id}`)}
                          >
                            <span className="material-icons-outlined">edit</span>
                          </button>
                          <button
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            onClick={() => handleDelete(outlet._id)}
                          >
                            <span className="material-icons-outlined">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-8 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing {filteredOutlets.length} of {outlets.length} outlets
            </span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 disabled:opacity-50"
                disabled
              >
                Previous
              </button>
              <button className="px-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">
                Next
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* QR Code Modal */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={`QR Code - ${selectedOutlet?.name}`}
        size="md"
      >
        <div className="space-y-6">
          {/* QR Code Display */}
          <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
            {qrCode?.qrCodeImage ? (
              <div className="bg-white p-6 rounded-2xl shadow-2xl border-4 border-primary/20">
                <img src={qrCode.qrCodeImage} alt="QR Code" className="w-64 h-64 object-contain" />
                <div className="mt-4 text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scan to Order</p>
                </div>
              </div>
            ) : (
              <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-400">
                <span className="material-icons-outlined text-6xl mb-4">qr_code_2</span>
                <p className="text-sm font-medium">No QR Code generated yet</p>
                <p className="text-xs mt-2 text-slate-400">Click regenerate to create one</p>
              </div>
            )}
          </div>

          {/* Regenerate Button */}
          <Button
            onClick={handleGenerateQR}
            className="w-full py-3 bg-primary hover:bg-primary/90"
            loading={generating}
          >
            {qrCode ? 'Regenerate QR Code' : 'Generate QR Code'}
          </Button>

          {/* Ordering Link */}
          {qrCode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-icons-outlined text-primary text-sm">link</span>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ordering Link</p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border-2 border-primary/20 rounded-xl overflow-hidden hover:border-primary/40 transition-all">
                <span className="text-xs text-primary font-mono truncate flex-1 font-bold">{qrCode.publicUrl}</span>
                <button
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(qrCode.publicUrl);
                      } else {
                        const textArea = document.createElement('textarea');
                        textArea.value = qrCode.publicUrl;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                      }
                      alert('Link copied to clipboard!');
                    } catch (err) {
                      console.error('Copy failed:', err);
                      alert('Failed to copy. Please copy manually: ' + qrCode.publicUrl);
                    }
                  }}
                  className="p-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-all flex items-center gap-1 text-primary font-bold text-xs"
                  title="Copy ordering link"
                >
                  <span className="material-icons-outlined text-sm">content_copy</span>
                  <span className="hidden sm:inline">Copy</span>
                </button>
              </div>
            </div>
          )}

          {/* Download Button */}
          <Button
            onClick={handleDownloadQR}
            className="w-full"
            variant="outline"
            disabled={!qrCode?.qrCodeImage}
          >
            <span className="material-icons-outlined text-lg">download</span>
            Download QR Code
          </Button>
        </div>
      </Modal>
    </Layout>
  );
};

export default OutletManagement;
