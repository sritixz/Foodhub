import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import api from '../utils/api';

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load categories');
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = () => {
    setFormData({ name: '', description: '' });
    setFormError('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Category name is required');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await api.post('/categories', formData);
      setShowCreateModal(false);
      fetchCategories();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (category) => {
    setSelectedCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
    setFormError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Category name is required');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      await api.put(`/categories/${selectedCategory._id}`, formData);
      setShowEditModal(false);
      fetchCategories();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to update category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (category) => {
    setDeleteTarget(category);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setSubmitting(true);
      await api.delete(`/categories/${deleteTarget._id}`);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      fetchCategories();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: "Category Management" }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading categories...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "Category Management",
        actionButton: (
          <Button onClick={handleCreateClick}>
            <span className="material-icons-outlined text-lg">add</span>
            Create Category
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

        {/* Categories Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-8 py-4">Name</th>
                  <th className="px-8 py-4">Description</th>
                  <th className="px-8 py-4">Menu Items</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-8 py-12 text-center text-slate-500 dark:text-slate-400">
                      No categories found. Create your first category to get started.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr
                      key={category._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-8 py-5">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{category.name}</h4>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {category.description || '-'}
                        </p>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {category.menuItemCount || 0}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            onClick={() => handleEditClick(category)}
                            title="Edit category"
                          >
                            <span className="material-icons-outlined">edit</span>
                          </button>
                          <button
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            onClick={() => handleDeleteClick(category)}
                            title="Delete category"
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
        </Card>
      </div>

      {/* Create Category Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Category"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <Input
            label="Category Name"
            placeholder="Enter category name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            maxLength={50}
          />
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-transparent dark:bg-transparent rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-slate-100"
              placeholder="Enter category description"
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              maxLength={200}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateModal(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Category"
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-6">
          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <Input
            label="Category Name"
            placeholder="Enter category name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            maxLength={50}
          />
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
              Description (Optional)
            </label>
            <textarea
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-transparent dark:bg-transparent rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-slate-100"
              placeholder="Enter category description"
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              maxLength={200}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowEditModal(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete Category"
        size="sm"
      >
        <div className="space-y-6">
          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to delete the category <strong>{deleteTarget?.name}</strong>?
          </p>
          {deleteTarget?.menuItemCount > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <span className="material-icons-outlined text-lg">warning</span>
                <div>
                  <p className="font-semibold">Warning</p>
                  <p className="mt-1">
                    This category has {deleteTarget.menuItemCount} menu item{deleteTarget.menuItemCount !== 1 ? 's' : ''} associated with it. 
                    You cannot delete this category until all menu items are reassigned or deleted.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteTarget(null);
                setFormError('');
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteConfirm}
              disabled={submitting || (deleteTarget?.menuItemCount > 0)}
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default CategoryManagement;
