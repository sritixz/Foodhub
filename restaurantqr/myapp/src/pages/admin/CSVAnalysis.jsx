import { useState } from 'react';
import Papa from 'papaparse';
import Layout from '../../components/Layout/Layout';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Select from '../../components/UI/Select';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const CSVAnalysis = () => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [chartType, setChartType] = useState('bar');
  const [error, setError] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true, // Auto-convert numbers
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Some rows could not be parsed correctly.');
        }
        
        const parsedData = results.data;
        if (parsedData.length > 0) {
          const cols = Object.keys(parsedData[0]);
          setHeaders(cols);
          setData(parsedData);
          
          // Try to auto-select axes
          const stringCols = cols.filter(c => typeof parsedData[0][c] === 'string');
          const numberCols = cols.filter(c => typeof parsedData[0][c] === 'number');
          
          if (stringCols.length > 0) setXAxis(stringCols[0]);
          if (numberCols.length > 0) setYAxis(numberCols[0]);
        }
      },
      error: (err) => {
        setError('Failed to parse CSV: ' + err.message);
      }
    });
  };

  const getChartData = () => {
    if (!xAxis || !yAxis) return [];
    
    // Group and sum by xAxis
    const aggregated = data.reduce((acc, row) => {
      const xVal = row[xAxis] || 'Unknown';
      const yVal = Number(row[yAxis]) || 0;
      
      if (!acc[xVal]) acc[xVal] = 0;
      acc[xVal] += yVal;
      return acc;
    }, {});
    
    return Object.keys(aggregated).map(key => ({
      name: key,
      value: aggregated[key]
    }));
  };

  const chartData = getChartData();

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom CSV Analysis</h1>
          <p className="text-gray-600">Upload any operational CSV to instantly generate reports and charts.</p>
        </div>
        <div>
          <label className="cursor-pointer bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-dark transition-colors inline-block">
            Upload CSV File
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}

      {data.length === 0 && !error && (
        <Card className="text-center py-12">
          <span className="material-icons-outlined text-6xl text-gray-300 mb-4 block">analytics</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Uploaded</h3>
          <p className="text-gray-500">Upload a CSV file to begin analyzing your data.</p>
        </Card>
      )}

      {data.length > 0 && (
        <div className="space-y-6">
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <Select
                label="X-Axis (Label/Category)"
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value)}
                options={headers.map(h => ({ value: h, label: h }))}
              />
              <Select
                label="Y-Axis (Numeric Value)"
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value)}
                options={headers.map(h => ({ value: h, label: h }))}
              />
              <Select
                label="Chart Type"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                options={[
                  { value: 'bar', label: 'Bar Chart' },
                  { value: 'line', label: 'Line Chart' }
                ]}
              />
            </div>
          </Card>

          {xAxis && yAxis && (
            <Card className="h-96 p-4">
              <h2 className="text-lg font-semibold mb-4 text-center">
                {yAxis} by {xAxis}
              </h2>
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: '#f5f5f5'}} />
                    <Legend />
                    <Bar dataKey="value" name={yAxis} fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" name={yAxis} stroke="#0ea5e9" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <h2 className="text-lg font-semibold mb-4">Raw Data Preview ({data.length} rows)</h2>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
                    {headers.map(header => (
                      <th key={header} className="p-3 border-b text-gray-700 font-medium">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      {headers.map(header => (
                        <td key={`${idx}-${header}`} className="p-3 text-gray-600">
                          {row[header] !== null && row[header] !== undefined ? row[header].toString() : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length > 100 && (
              <p className="text-center text-sm text-gray-500 mt-4">Showing first 100 rows. Export or use analytics for full dataset.</p>
            )}
          </Card>
        </div>
      )}
    </Layout>
  );
};

export default CSVAnalysis;
