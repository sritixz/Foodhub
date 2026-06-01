import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 1,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for sorting (unique index on name is already created by schema field definition)
categorySchema.index({ createdAt: -1 });

// Instance method to count associated menu items
categorySchema.methods.getMenuItemCount = async function() {
  const MenuItem = mongoose.model('MenuItem');
  return await MenuItem.countDocuments({ category: this._id });
};

const Category = mongoose.model('Category', categorySchema);

export default Category;
