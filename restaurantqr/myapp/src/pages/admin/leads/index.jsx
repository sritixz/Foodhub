import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../../components/Layout/Layout';
import MenuLeadsTab from './MenuLeadsTab';
import FranchiseTab from './FranchiseTab';
import NewsletterTab from './NewsletterTab';

const tabs = [
  { key: 'menu-leads', label: 'Menu Leads', path: '/admin/leads/menu-leads' },
  { key: 'franchise-requests', label: 'Franchise Requests', path: '/admin/leads/franchise-requests' },
  { key: 'newsletter-subscribers', label: 'Newsletter Subscribers', path: '/admin/leads/newsletter-subscribers' },
];

const Leads = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect /admin/leads to /admin/leads/menu-leads
  useEffect(() => {
    if (location.pathname === '/admin/leads' || location.pathname === '/admin/leads/') {
      navigate('/admin/leads/menu-leads', { replace: true });
    }
  }, [location.pathname, navigate]);

  const activeTab = tabs.find(t => location.pathname.includes(t.key))?.key || 'menu-leads';

  const renderTab = () => {
    switch (activeTab) {
      case 'franchise-requests':
        return <FranchiseTab />;
      case 'newsletter-subscribers':
        return <NewsletterTab />;
      default:
        return <MenuLeadsTab />;
    }
  };

  return (
    <Layout headerProps={{ title: 'Leads & Enquiries' }}>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage all incoming leads from the MOPY landing page
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="flex gap-6 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => navigate(tab.path)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {renderTab()}
      </div>
    </Layout>
  );
};

export default Leads;
