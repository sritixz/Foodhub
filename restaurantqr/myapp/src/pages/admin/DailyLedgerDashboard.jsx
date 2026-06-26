import { useEffect, useState } from 'react';
import Layout from '../../components/Layout/Layout';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import api from '../../utils/api';

const DailyLedgerDashboard = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (date) {
      fetchLedgers();
    }
  }, [date]);

  const fetchLedgers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/ledger/daily?date=${date}`);
      setLedgers(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch ledgers. ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Group unique items across all ledgers to form rows
  const getUniqueItems = () => {
    const itemMap = new Map();
    ledgers.forEach(ledger => {
      ledger.items.forEach(item => {
        if (!itemMap.has(item.menuItem._id)) {
          itemMap.set(item.menuItem._id, {
            id: item.menuItem._id,
            name: item.menuItem.name,
            category: item.menuItem.category,
            cp: item.costPrice,
            sp: item.sellingPrice
          });
        }
      });
    });
    return Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const uniqueItems = getUniqueItems();

  const calculateRowTotal = (itemId, field) => {
    let total = 0;
    ledgers.forEach(ledger => {
      const item = ledger.items.find(i => i.menuItem._id === itemId);
      if (item) {
        total += item[field] || 0;
      }
    });
    return total;
  };

  const calculateBottomTotal = (category, field) => {
    let total = 0;
    ledgers.forEach(ledger => {
      total += ledger[category]?.[field] || 0;
    });
    return total;
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Account Ledger</h1>
          <p className="text-gray-600">Consolidated B2B view of all outlet operations.</p>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <Input
            type="date"
            label="Select Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
          />
          <Button onClick={fetchLedgers} loading={loading}>Load Ledger</Button>
        </div>
      </Card>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}

      {!loading && ledgers.length === 0 && (
        <Card>
          <div className="text-center py-8 text-gray-500">
            No daily ledgers submitted for this date.
          </div>
        </Card>
      )}

      {!loading && ledgers.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200 mb-6">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead>
              {/* Main Header with Outlet Names */}
              <tr>
                <th className="p-2 border-b border-r bg-gray-100 font-bold sticky left-0 z-10" rowSpan="2" style={{ minWidth: '150px' }}>Item Name</th>
                <th className="p-2 border-b border-r bg-gray-100 font-bold text-center" rowSpan="2">CP</th>
                
                {ledgers.map(ledger => (
                  <th key={ledger.outlet._id} className="p-2 border-b border-r bg-blue-50 text-center font-bold text-blue-900" colSpan="7">
                    {ledger.outlet.name}
                  </th>
                ))}
                
                <th className="p-2 border-b bg-green-50 text-center font-bold text-green-900" colSpan="7">
                  TOTAL (All Outlets)
                </th>
              </tr>
              
              {/* Sub Header with Metrics */}
              <tr>
                {ledgers.map(ledger => (
                  <tr key={`sub-${ledger.outlet._id}`} className="contents">
                    <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold">Sent</th>
                    <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold">Sold</th>
                    <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold text-red-600">Waste</th>
                    <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold">SP</th>
                    <th className="p-2 border-b border-r bg-yellow-50 text-xs font-semibold">Revenue</th>
                    <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold">Costing</th>
                    <th className="p-2 border-b border-r bg-green-50 text-xs font-semibold">GP</th>
                  </tr>
                ))}
                {/* Total Sub Header */}
                <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold">Sent</th>
                <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold">Sold</th>
                <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold text-red-600">Waste</th>
                <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold">-</th>
                <th className="p-2 border-b border-r bg-yellow-50 text-xs font-semibold">Revenue</th>
                <th className="p-2 border-b border-r bg-gray-50 text-xs font-semibold">Costing</th>
                <th className="p-2 border-b border-r bg-green-50 text-xs font-semibold">GP</th>
              </tr>
            </thead>
            <tbody>
              {/* Items Rows */}
              {uniqueItems.map((uItem) => (
                <tr key={uItem.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 border-r bg-white font-medium sticky left-0 z-10">{uItem.name}</td>
                  <td className="p-2 border-r text-center">{uItem.cp}</td>
                  
                  {ledgers.map(ledger => {
                    const itemData = ledger.items.find(i => i.menuItem._id === uItem.id);
                    if (!itemData) {
                      return <tr key={`empty-${ledger.outlet._id}`} className="contents"><td colSpan="7" className="p-2 border-r text-center text-gray-300">-</td></tr>;
                    }
                    return (
                      <tr key={`data-${ledger.outlet._id}`} className="contents">
                        <td className="p-2 border-r text-center">{itemData.sentQty}</td>
                        <td className="p-2 border-r text-center">{itemData.totalSoldQty}</td>
                        <td className={`p-2 border-r text-center ${itemData.wastageQty > 0 ? 'text-red-500' : ''}`}>{itemData.wastageQty}</td>
                        <td className="p-2 border-r text-center">{itemData.sellingPrice}</td>
                        <td className="p-2 border-r text-center bg-yellow-50 font-medium text-yellow-800">{itemData.revenue}</td>
                        <td className="p-2 border-r text-center">{itemData.costing}</td>
                        <td className="p-2 border-r text-center bg-green-50 font-medium text-green-800">{itemData.grossProfit}</td>
                      </tr>
                    );
                  })}
                  
                  {/* Total Calculations for this Item */}
                  <td className="p-2 border-r text-center font-semibold bg-gray-50">{calculateRowTotal(uItem.id, 'sentQty')}</td>
                  <td className="p-2 border-r text-center font-semibold bg-gray-50">{calculateRowTotal(uItem.id, 'totalSoldQty')}</td>
                  <td className="p-2 border-r text-center font-semibold text-red-600 bg-gray-50">{calculateRowTotal(uItem.id, 'wastageQty')}</td>
                  <td className="p-2 border-r text-center bg-gray-50">-</td>
                  <td className="p-2 border-r text-center font-semibold bg-yellow-100">{calculateRowTotal(uItem.id, 'revenue')}</td>
                  <td className="p-2 border-r text-center font-semibold bg-gray-50">{calculateRowTotal(uItem.id, 'costing')}</td>
                  <td className="p-2 border-r text-center font-semibold bg-green-100">{calculateRowTotal(uItem.id, 'grossProfit')}</td>
                </tr>
              ))}
              
              {/* Spacer Row */}
              <tr><td colSpan={2 + (ledgers.length * 7) + 7} className="h-4 bg-gray-100 border-b"></td></tr>
              
              {/* Bottom Financial Summary Rows */}
              {[
                { label: 'Total Revenue', category: 'financials', field: 'totalRevenue', style: 'font-bold bg-yellow-50', spanCol: 4, valColSpan: 3 },
                { label: 'Total Food Cost', category: 'financials', field: 'totalCosting', style: 'font-medium', spanCol: 5, valColSpan: 2 },
                { label: 'Gross Profit (GP)', category: 'financials', field: 'grossProfit', style: 'font-bold text-green-700 bg-green-50', spanCol: 6, valColSpan: 1 },
                { label: 'Cash Collection', category: 'collections', field: 'actualCash', style: 'font-medium text-gray-700', spanCol: 6, valColSpan: 1 },
                { label: 'GPay Collection', category: 'collections', field: 'actualGpay', style: 'font-medium text-gray-700', spanCol: 6, valColSpan: 1 },
                { label: 'Salary Exp', category: 'expenses', field: 'salary', style: 'font-medium text-red-600', spanCol: 6, valColSpan: 1 },
                { label: 'Transport Exp', category: 'expenses', field: 'transport', style: 'font-medium text-red-600', spanCol: 6, valColSpan: 1 },
                { label: 'Corp Exp', category: 'expenses', field: 'corp', style: 'font-medium text-red-600', spanCol: 6, valColSpan: 1 },
                { label: 'Other Exp', category: 'expenses', field: 'other', style: 'font-medium text-red-600', spanCol: 6, valColSpan: 1 },
                { label: 'Indirect Exp Total', category: 'financials', field: 'indirectExpenses', style: 'font-bold text-red-700 bg-red-50', spanCol: 6, valColSpan: 1 },
                { label: 'NET PROFIT (NP)', category: 'financials', field: 'netProfit', style: 'font-extrabold text-xl text-green-800 bg-green-100', spanCol: 6, valColSpan: 1 },
              ].map((row, idx) => (
                <tr key={idx} className="border-b">
                  <td colSpan="2" className={`p-2 border-r text-right ${row.style} sticky left-0 z-10`}>{row.label}</td>
                  
                  {ledgers.map(ledger => (
                    <tr key={`sum-${ledger.outlet._id}`} className="contents">
                       <td colSpan={row.spanCol} className="border-r border-b bg-gray-50"></td>
                       <td colSpan={row.valColSpan} className={`p-2 border-r text-center ${row.style}`}>
                         {ledger[row.category]?.[row.field] || 0}
                       </td>
                    </tr>
                  ))}
                  
                  {/* Global Totals for Summary */}
                  <td colSpan={row.spanCol} className="border-r border-b bg-gray-50"></td>
                  <td colSpan={row.valColSpan} className={`p-2 border-r text-center ${row.style}`}>
                    {calculateBottomTotal(row.category, row.field)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
};

export default DailyLedgerDashboard;
