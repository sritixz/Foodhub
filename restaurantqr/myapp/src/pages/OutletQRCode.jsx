import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import api from '../utils/api';

const OutletQRCode = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [outlet, setOutlet] = useState(null);
    const [qrCode, setQrCode] = useState(null);
    const [tableNumber, setTableNumber] = useState('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchOutletAndQRCode();
    }, [id]);

    const fetchOutletAndQRCode = async () => {
        try {
            setLoading(true);
            const [outletRes, qrcodeRes] = await Promise.all([
                api.get(`/outlets/${id}`),
                api.get(`/qrcode/outlet/${id}`)
            ]);
            setOutlet(outletRes.data);
            if (qrcodeRes.data && qrcodeRes.data.length > 0) {
                setQrCode(qrcodeRes.data[0]); // Take the latest one
            }
        } catch (err) {
            setError('Failed to load outlet or QR code data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            setError('');
            const response = await api.post(`/qrcode/outlet/${id}`, { tableNumber });
            setQrCode(response.data.qrCode);
            alert('QR Code generated successfully!');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate QR code');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!qrCode?.qrCodeImage) return;

        const link = document.createElement('a');
        link.href = qrCode.qrCodeImage;
        link.download = `QR_${outlet.name.replace(/\s+/g, '_')}${tableNumber ? '_Table_' + tableNumber : ''}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <Layout headerProps={{ title: "QR Code Management" }}>
                <div className="flex items-center justify-center p-8 h-full">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout
            headerProps={{
                title: "QR Code Management",
                subtitle: outlet?.name,
                backButton: true,
                onBack: () => navigate('/outlets')
            }}
        >
            <div className="max-w-2xl mx-auto space-y-6">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                <Card>
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

                        {qrCode && (
                            <div className="mt-6 text-center space-y-3 w-full">
                                <div className="flex items-center justify-center gap-2">
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
                                                    // Fallback for non-secure contexts
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
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                    👆 Share this link or scan the QR code to start ordering
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 space-y-4">
                        <Button
                            onClick={handleGenerate}
                            className="w-full py-4 bg-primary hover:bg-primary/90 text-lg"
                            loading={generating}
                        >
                            {qrCode ? 'Regenerate QR Code' : 'Generate QR Code'}
                        </Button>

                        <div className="flex gap-3">
                            <Button
                                onClick={handleDownload}
                                className="flex-1"
                                variant="outline"
                                disabled={!qrCode?.qrCodeImage}
                            >
                                <span className="material-icons-outlined text-lg">download</span>
                                Download QR Code
                            </Button>
                            <Button
                                onClick={() => window.open(qrCode?.publicUrl, '_blank')}
                                className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                                disabled={!qrCode?.publicUrl}
                            >
                                <span className="material-icons-outlined text-lg">open_in_new</span>
                                Test Menu
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </Layout>
    );
};

export default OutletQRCode;
