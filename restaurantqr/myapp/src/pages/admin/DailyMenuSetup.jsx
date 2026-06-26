import { useEffect, useState } from 'react';
import Layout from '../../components/Layout/Layout';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import api from '../../utils/api';

const DailyMenuSetup = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [mealsSelection, setMealsSelection] = useState({}); // { itemId: { breakfast: true, lunch: false, ... } }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    try {
      // Fetch menu catalog for this outlet
      const catalogRes = await api.get(`/menu-items`);
      const outletCatalog = catalogRes.data.filter(
        item => item.vendor?._id === selectedOutlet || item.outlets?.some(o => o._id === selectedOutlet) || item.applyToAll
      );
      setMenuItems(outletCatalog);

      // Fetch existing daily menu
      const dailyRes = await api.get(`/daily-menu?date=${date}&outletId=${selectedOutlet}`);
      const selection = {};
      
      // Initialize selection
      outletCatalog.forEach(item => {
        selection[item._id] = {
          breakfast: false,
          lunch: false,
          fullMeal: false,
          snack: false,
        };
      });

      if (dailyRes.data && dailyRes.data.meals) {
        const { breakfast, lunch, fullMeal, snack } = dailyRes.data.meals;
        breakfast.forEach(i => { if (selection[i._id || i]) selection[i._id || i].breakfast = true; });
        lunch.forEach(i => { if (selection[i._id || i]) selection[i._id || i].lunch = true; });
        fullMeal.forEach(i => { if (selection[i._id || i]) selection[i._id || i].fullMeal = true; });
        snack.forEach(i => { if (selection[i._id || i]) selection[i._id || i].snack = true; });
      }

      setMealsSelection(selection);
    } catch (err) {
      console.error(err);
      setError('Failed to load menu data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (itemId, mealType, checked) => {
    setMealsSelection(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [mealType]: checked
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const meals = {
        breakfast: [],
        lunch: [],
        fullMeal: [],
        snack: [],
      };

      Object.entries(mealsSelection).forEach(([itemId, types]) => {
        if (types.breakfast) meals.breakfast.push(itemId);
        if (types.lunch) meals.lunch.push(itemId);
        if (types.fullMeal) meals.fullMeal.push(itemId);
        if (types.snack) meals.snack.push(itemId);
      });

      await api.post('/daily-menu', { date, outlet: selectedOutlet, meals });
      setSuccess('Daily menu saved successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to save daily menu. ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Menu Setup</h1>
          <p className="text-gray-600">Configure which items from the catalog are available for each meal on a specific date.</p>
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
          <Button onClick={fetchData} loading={loading}>Load Data</Button>
        </div>
      </Card>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}
      {success && <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-lg">{success}</div>}

      {!loading && menuItems.length > 0 && (
        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 font-medium text-gray-600">Menu Item</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Breakfast</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Lunch</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Full Meal</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Snack</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item) => (
                    <tr key={item._id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">
                        {item.name}
                        <div className="text-xs text-gray-500">{item.category?.name || item.category}</div>
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={mealsSelection[item._id]?.breakfast || false}
                          onChange={(e) => handleCheckboxChange(item._id, 'breakfast', e.target.checked)}
                          className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={mealsSelection[item._id]?.lunch || false}
                          onChange={(e) => handleCheckboxChange(item._id, 'lunch', e.target.checked)}
                          className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={mealsSelection[item._id]?.fullMeal || false}
                          onChange={(e) => handleCheckboxChange(item._id, 'fullMeal', e.target.checked)}
                          className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={mealsSelection[item._id]?.snack || false}
                          onChange={(e) => handleCheckboxChange(item._id, 'snack', e.target.checked)}
                          className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" loading={saving} size="lg">Save Daily Menu</Button>
          </div>
        </form>
      )}
      
      {!loading && menuItems.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-gray-500">No menu items found in the catalog for this outlet.</p>
        </Card>
      )}
    </Layout>
  );
};

export default DailyMenuSetup;
