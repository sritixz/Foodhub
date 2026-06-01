import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';

const QRScan = () => {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState('');
  const [error, setError] = useState('');

  const handleScan = () => {
    if (!qrCode.trim()) {
      setError('Please enter a QR code');
      return;
    }

    // Navigate to QR menu page with QR data
    navigate(`/qr/menu?qr=${encodeURIComponent(qrCode)}`);
  };

  const handleManualEntry = (e) => {
    setQrCode(e.target.value);
    setError('');
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <div className="text-center mb-6">
          <span className="material-icons-outlined text-6xl text-primary mb-4">qr_code_scanner</span>
          <h1 className="text-2xl font-bold mb-2">Scan QR Code</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Scan the QR code on the table or enter it manually
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="QR Code"
            placeholder="Enter QR code or scan"
            value={qrCode}
            onChange={handleManualEntry}
            onKeyPress={(e) => e.key === 'Enter' && handleScan()}
          />

          <Button onClick={handleScan} className="w-full">
            Continue to Menu
          </Button>

          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            <p>Or use your camera to scan</p>
            <p className="text-xs mt-2">Camera access will be requested</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default QRScan;
