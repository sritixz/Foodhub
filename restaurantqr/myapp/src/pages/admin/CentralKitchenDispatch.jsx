import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout/Layout';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import api from '../../utils/api';
import { parseImportFile } from '../../utils/fileParser';

const CentralKitchenDispatch = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    try {
      const res = await api.get('/outlets');
      setOutlets(res.data);
      if (res.data.length > 0) setSelectedOutlet(res.data[0]._id);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch outlets.');
    }
  };

  useEffect(() => {
    if (date && selectedOutlet) {
      fetchData();
    }
  }, [date, selectedOutlet]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setWarning('');
    try {
      // Fetch daily menu for this outlet
      const dailyMenuRes = await api.get(`/daily-menu?date=${date}&outletId=${selectedOutlet}`);
      let outletMenu = [];
      
      if (dailyMenuRes.data && dailyMenuRes.data.meals) {
         const meals = dailyMenuRes.data.meals;
         const allItems = [...(meals.breakfast || []), ...(meals.lunch || []), ...(meals.fullMeal || []), ...(meals.snack || [])];
         const uniqueMap = new Map();
         allItems.forEach(i => {
           if(i) uniqueMap.set(i._id, i);
         });
         outletMenu = Array.from(uniqueMap.values());
      } else {
         // Fallback to full catalog if daily menu isn't configured yet
         const menuRes = await api.get('/menu-items');
         outletMenu = menuRes.data.filter(
           item => item.vendor?._id === selectedOutlet || item.outlets?.some(o => o._id === selectedOutlet) || item.applyToAll
         );
      }

      const initialItems = outletMenu.map(menuItem => ({
        menuItem: menuItem._id,
        name: menuItem.name,
        category: menuItem.category?.name || 'General',
        costPrice: menuItem.costPrice || 0,
        sellingPrice: menuItem.basePrice || 0,
        sentQty: '',
      }));

      // Check if ledger already has sentQty
      try {
        const ledgerRes = await api.get(`/ledger/outlet?date=${date}&outletId=${selectedOutlet}`);
        if (ledgerRes.data) {
          const savedItems = ledgerRes.data.items;
          const mergedItems = initialItems.map(initItem => {
            const saved = savedItems.find(s => s.menuItem?._id === initItem.menuItem);
            if (saved) {
              return {
                ...initItem,
                costPrice: saved.costPrice !== undefined ? saved.costPrice : initItem.costPrice,
                sellingPrice: saved.sellingPrice !== undefined ? saved.sellingPrice : initItem.sellingPrice,
                sentQty: saved.sentQty
              };
            }
            return initItem;
          });
          setItems(mergedItems);
          if(ledgerRes.data.status === 'Approved'){
             setError('This ledger has been approved and cannot be edited.');
          }
        }
      } catch (err) {
        setItems(initialItems);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index, value) => {
    const updated = [...items];
    updated[index].sentQty = value;
    setItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payloadItems = items.filter(item => item.sentQty !== '' && Number(item.sentQty) > 0).map(item => ({
        menuItem: item.menuItem,
        sentQty: Number(item.sentQty),
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice
      }));

      if(payloadItems.length === 0){
          setError('Please enter sent quantity for at least one item.');
          setSaving(false);
          return;
      }

      await api.post('/ledger/dispatch', { date, outlet: selectedOutlet, items: payloadItems });
      setSuccess('Dispatch quantities successfully saved to ledger!');
    } catch (err) {
      console.error(err);
      setError('Failed to save dispatch. ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "Item Name,Sent Qty\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Dispatch_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setWarning('');

    try {
      const result = await parseImportFile(file, items);
      if (result.items) {
        setItems(result.items);
      }
      setSuccess(`Successfully imported data from file (${result.matchCount} items matched).`);
      if (result.unmatched && result.unmatched.length > 0) {
        setWarning(`Warning: The following items from the file did not match any catalog items: ${result.unmatched.join(', ')}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError('Error parsing file: ' + err.message);
    }
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Central Kitchen Dispatch</h1>
          <p className="text-gray-600">Log the sent quantity for each outlet to lock their EOD inventory.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            Download Template
          </Button>
          <input 
            type="file" 
            accept=".csv,.xlsx,.xls" 
            ref={fileInputRef}
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Import CSV/Excel
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <Input
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Outlet</label>
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            >
              {outlets.map(o => (
                <option key={o._id} value={o._id}>{o.name}</option>
              ))}
            </select>
          </div>
          <Button onClick={fetchData} loading={loading}>Load Menu</Button>
        </div>
      </Card>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}
      {success && <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-lg">{success}</div>}
      {warning && <div className="p-4 mb-4 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">{warning}</div>}

      {!loading && items.length > 0 && (
        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Dispatch Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 font-medium text-gray-600">Item Name</th>
                    <th className="p-3 font-medium text-gray-600">Category</th>
                    <th className="p-3 font-medium text-gray-600">CP (₹)</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Dispatch Qty (Sent)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.menuItem} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{item.name}</td>
                      <td className="p-3 text-gray-500 text-sm">{item.category}</td>
                      <td className="p-3 text-gray-600">{item.costPrice}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.sentQty}
                          onChange={(e) => handleItemChange(index, e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-primary"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" loading={saving} size="lg">Confirm Dispatch</Button>
          </div>
        </form>
      )}
    </Layout>
  );
};

export default CentralKitchenDispatch;
