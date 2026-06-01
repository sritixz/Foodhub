import { useState, useEffect } from 'react';
import Button from './UI/Button';
import Input from './UI/Input';

const CategoryForm = ({ initialData = {}, onSubmit, onCancel, isEdit = false, loading = false }) => {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    description: initialData.description || '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData({
      name: initialData.name || '',
      description: initialData.description || '',
    });
    setErrors({});
  }, [initialData.name, initialData.description]);

  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      newErrors.name = 'Category name is required';
    } else if (trimmedName.length > 50) {
      newErrors.name = 'Category name must be 50 characters or less';
    }

    if (formData.description.length > 200) {
      newErrors.description = 'Description must be 200 characters or less';
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit({ name: formData.name.trim(), description: formData.description.trim() });
  };

  const handleNameChange = (e) => {
    setFormData({ ...formData, name: e.target.value });
    if (errors.name) setErrors({ ...errors, name: '' });
  };

  const handleDescriptionChange = (e) => {
    setFormData({ ...formData, description: e.target.value });
    if (errors.description) setErrors({ ...errors, description: '' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Category Name"
        placeholder="Enter category name"
        value={formData.name}
        onChange={handleNameChange}
        maxLength={50}
        error={errors.name}
        required
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Description <span className="text-slate-400 font-normal">(Optional)</span>
        </label>
        <textarea
          className={`w-full px-4 py-2 border bg-transparent rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-slate-100 ${
            errors.description
              ? 'border-red-500'
              : 'border-slate-300 dark:border-slate-700'
          }`}
          placeholder="Enter category description"
          rows="3"
          value={formData.description}
          onChange={handleDescriptionChange}
          maxLength={200}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description}</p>
        )}
        <p className="text-xs text-slate-400 text-right">{formData.description.length}/200</p>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Category' : 'Create Category')}
        </Button>
      </div>
    </form>
  );
};

export default CategoryForm;
