import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';
import Select from '../components/UI/Select';
import Input from '../components/UI/Input';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedOutlet, setSelectedOutlet] = useState('All Outlets');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [outlets, setOutlets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Employee',
    organization: '',
    outlet: '',
    password: '',
    status: 'Active',
  });

  useEffect(() => {
    fetchUsers();
    fetchOutlets();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/users');
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOutlets = async () => {
    try {
      const response = await api.get('/outlets');
      setOutlets(response.data || []);
    } catch (err) {
      console.error('Error fetching outlets:', err);
    }
  };

  useEffect(() => {
    let filtered = users;

    if (selectedRole !== 'All Roles') {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    if (selectedStatus !== 'All Status') {
      filtered = filtered.filter(user => user.status === selectedStatus);
    }

    if (selectedOutlet !== 'All Outlets') {
      filtered = filtered.filter(user => {
        const outletId = user.outlet?._id || user.outlet;
        const outletName = user.outlet?.name || user.outlet;
        return outletId === selectedOutlet || outletName === selectedOutlet;
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(
        user =>
          user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  }, [selectedRole, selectedStatus, selectedOutlet, searchTerm, users]);

  const baseRoles = ['Admin', 'Company Admin', 'Staff', 'Delivery Staff', 'Vendor', 'Employee'];
  const allowedRoles = user?.role === 'Company Admin'
    ? ['Staff', 'Delivery Staff', 'Employee']
    : baseRoles;
  const roles = ['All Roles', ...allowedRoles];
  const statuses = ['All Status', 'Active', 'Inactive'];
  const outletFilters = ['All Outlets', ...new Set(users.map(user => user.outlet?.name || user.outlet).filter(Boolean))];

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: allowedRoles.includes('Employee') ? 'Employee' : allowedRoles[0],
      organization: user?.organization || '',
      outlet: '',
      password: '',
      status: 'Active',
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (selectedUser) => {
    setEditingUser(selectedUser);
    setFormData({
      name: selectedUser.name || '',
      email: selectedUser.email || '',
      phone: selectedUser.phone || '',
      role: selectedUser.role || 'Employee',
      organization: selectedUser.organization || user?.organization || '',
      outlet: selectedUser.outlet?._id || selectedUser.outlet || '',
      password: '',
      status: selectedUser.status || 'Active',
    });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveUser = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.role) {
      setError('Please fill all required fields');
      return;
    }

    if (!editingUser && !formData.password) {
      setError('Password is required for new users');
      return;
    }

    setSubmitting(true);
    try {
      setError('');
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        organization: formData.organization || undefined,
        outlet: formData.outlet || null,
        status: formData.status,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await api.put(`/users/${editingUser._id}`, payload);
      } else {
        await api.post('/users', payload);
      }

      await fetchUsers();
      handleCloseForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (selectedUser) => {
    if (!selectedUser?._id) {
      return;
    }

    const confirmDelete = window.confirm(`Delete ${selectedUser.name}?`);
    if (!confirmDelete) {
      return;
    }

    try {
      await api.delete(`/users/${selectedUser._id}`);
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: "User Management" }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading users...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "User Management",
        actionButton: (
          <Button onClick={handleOpenCreate}>
            <span className="material-icons-outlined mr-2">add</span>
            Create User
          </Button>
        ),
      }}
    >
      <div className="pb-4">
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              options={roles}
              className="w-full min-w-[150px]"
            />
          </div>
          <div className="relative">
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={statuses}
              className="w-full min-w-[150px]"
            />
          </div>
          <div className="relative">
            <Select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              options={outletFilters}
              className="w-full min-w-[150px]"
            />
          </div>
          <div className="flex-1 relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-700 dark:text-slate-300"
              placeholder="Search users..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="pb-8 flex-1">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <input
                      className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary focus:ring-offset-0 bg-transparent"
                      type="checkbox"
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Associated Outlet
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary focus:ring-offset-0 bg-transparent"
                          type="checkbox"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{user.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${user.role === 'Admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                            user.role === 'Company Admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              user.role === 'Vendor' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {user.outlet?.name || user.outlet || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 dark:text-slate-400">{user.email}</div>
                        <div className="text-xs text-slate-400">{user.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Showing 1-{filteredUsers.length} of {users.length} users
          </span>
          <div className="flex items-center space-x-1">
            <button className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
              <span className="material-icons-outlined text-sm">chevron_left</span>
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-white font-medium text-sm">
              1
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm">
              2
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm">
              3
            </button>
            <span className="px-2 text-slate-400">...</span>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm">
              16
            </button>
            <button className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span className="material-icons-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button
                onClick={handleCloseForm}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="Enter full name"
                />
                <Input
                  label="Email"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  placeholder="Enter email address"
                  type="email"
                />
                <Input
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                />
                <Select
                  label="Role"
                  value={formData.role}
                  onChange={(e) => handleFormChange('role', e.target.value)}
                  options={allowedRoles}
                />
                <Input
                  label="Organization"
                  value={formData.organization}
                  onChange={(e) => handleFormChange('organization', e.target.value)}
                  placeholder="Organization name"
                  disabled={user?.role === 'Company Admin'}
                />
                <Select
                  label="Outlet"
                  value={formData.outlet}
                  onChange={(e) => handleFormChange('outlet', e.target.value)}
                  options={['', ...outlets.map((outlet) => ({ label: outlet.name, value: outlet._id }))]}
                />
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                  options={['Active', 'Inactive']}
                />
                <Input
                  label={editingUser ? 'New Password (optional)' : 'Password'}
                  value={formData.password}
                  onChange={(e) => handleFormChange('password', e.target.value)}
                  placeholder={editingUser ? 'Leave empty to keep current password' : 'Enter password'}
                  type="password"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={handleCloseForm}>
                Cancel
              </Button>
              <Button onClick={handleSaveUser} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save User'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default UserManagement;
