import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const { user } = useAuth();
    if (user?.role === 'Investor') {
        return <Navigate to="/investor/dashboard" replace />;
    }
    const [outlets, setOutlets] = useState([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalOrders: 0,
        activeOutlets: 0,
        avgOrderValue: 0
    });
    const [timeFilter, setTimeFilter] = useState('Today');
    const [loading, setLoading] = useState(true);

    const getDateRangeLabel = () => {
        const now = new Date();
        const options = { day: 'numeric', month: 'short', year: 'numeric' };

        if (timeFilter === 'Today') {
            return now.toLocaleDateString('en-IN', { weekday: 'long', ...options });
        }

        if (timeFilter === 'This Week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            return `${startOfWeek.toLocaleDateString('en-IN', options)} – ${endOfWeek.toLocaleDateString('en-IN', options)}`;
        }

        if (timeFilter === 'This Month') {
            const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return `${startOfMonth.getDate()} – ${endOfMonth.getDate()} ${monthName}`;
        }

        return '';
    };

    useEffect(() => {
        fetchDashboardData();
    }, [timeFilter]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [outletsRes, ordersRes] = await Promise.all([
                api.get('/outlets'),
                api.get('/orders')
            ]);

            const outletsData = outletsRes.data || [];
            const ordersData = ordersRes.data || [];

            setOutlets(outletsData);

            // Simple stats calculation for demo
            const totalRevenue = ordersData.reduce((sum, order) => {
                const orderTotal = order.items?.reduce((s, item) => s + (item.price * item.quantity), 0) || 0;
                return sum + orderTotal;
            }, 0);

            setStats({
                totalRevenue,
                totalOrders: ordersData.length,
                activeOutlets: outletsData.length,
                avgOrderValue: ordersData.length > 0 ? totalRevenue / ordersData.length : 0
            });

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout headerProps={{ title: "Business Dashboard" }}>
            <div className="space-y-6">
                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="p-0 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                    <span className="material-icons-outlined">payments</span>
                                </div>
                                <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">+12.5%</span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Revenue</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">₹{stats.totalRevenue.toLocaleString()}</h3>
                        </div>
                    </Card>

                    <Card className="p-0 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
                                    <span className="material-icons-outlined">shopping_bag</span>
                                </div>
                                <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">+8.2%</span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Orders</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.totalOrders}</h3>
                        </div>
                    </Card>

                    <Card className="p-0 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                                    <span className="material-icons-outlined">storefront</span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Active Outlets</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.activeOutlets}</h3>
                        </div>
                    </Card>

                    <Card className="p-0 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                                    <span className="material-icons-outlined">trending_up</span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Avg. Order Value</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">₹{stats.avgOrderValue.toFixed(2)}</h3>
                        </div>
                    </Card>
                </div>

                {/* Sales Overview Graph */}
                <Card title="Sales Overview">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                            {['Today', 'This Week', 'This Month'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setTimeFilter(filter)}
                                    className={`px-5 py-1.5 text-sm font-medium rounded-lg transition-all ${timeFilter === filter
                                        ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            {getDateRangeLabel()}
                        </p>
                    </div>
                    <div className="p-8">
                        <div className="relative h-72 flex items-end gap-3 md:gap-6 pt-10 px-4">
                            <div className="absolute inset-x-0 top-10 flex flex-col justify-between h-[calc(100%-2.5rem)] pointer-events-none">
                                {[60000, 45000, 30000, 15000, 0].map((value, idx) => (
                                    <div
                                        key={idx}
                                        className={`border-b w-full relative ${idx === 4 ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800'
                                            }`}
                                    >
                                        <span className="absolute -left-10 -top-2.5 text-[10px] text-slate-400 font-medium">
                                            {value.toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 flex items-end justify-between px-2 h-full">
                                {Array.from({ length: 12 }).map((_, idx) => (
                                    <div key={idx} className="group relative flex flex-col items-center gap-1 w-8 md:w-12 h-full justify-end">
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-sm h-[85%] relative overflow-hidden">
                                            <div
                                                className="absolute bottom-0 w-full bg-primary"
                                                style={{ height: `${50 + Math.random() * 40}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 text-center">
                            <span className="text-xs font-medium text-slate-500 tracking-wider">SALES PERFORMANCE</span>
                        </div>
                    </div>
                </Card>

                {/* Recent Outlets Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="Top Performing Outlets">
                        <div className="space-y-4">
                            {outlets.slice(0, 5).map((outlet) => (
                                <div key={outlet._id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-primary">
                                            <span className="material-icons-outlined">store</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{outlet.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{outlet.outletId}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">₹{(outlet.sales?.monthly || 0).toLocaleString()}</p>
                                        <p className="text-[10px] text-green-600 font-medium">+5.4%</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card title="Order Type Distribution">
                        <div className="h-64 flex items-center justify-center">
                            <div className="relative w-48 h-48 rounded-full border-[16px] border-slate-100 dark:border-slate-800 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full border-[16px] border-primary border-t-transparent border-l-transparent transform rotate-45"></div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold">72%</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Dine-in</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-primary"></div>
                                <span className="text-xs text-slate-600 dark:text-slate-400">Dine-in</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                <span className="text-xs text-slate-600 dark:text-slate-400">Delivery</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
