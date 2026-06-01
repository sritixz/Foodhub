# Implementation Plan: Dynamic Category Management

## Overview

This implementation plan breaks down the dynamic category management feature into discrete, incremental coding tasks. Each task builds on previous work, with testing integrated throughout to validate functionality early. The implementation follows this sequence: backend models → backend API → migration → frontend components → integration.

## Tasks

- [x] 1. Create Category model and database schema
  - Create `server/models/Category.js` with schema definition
  - Define fields: name (unique, required, 1-50 chars), description (optional, max 200 chars), timestamps
  - Add indexes: unique index on name, index on createdAt for sorting
  - Add instance method `getMenuItemCount()` to count associated menu items
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.1 Write property test for category name uniqueness
  - **Property 1: Category name uniqueness**
  - **Validates: Requirements 1.2, 2.2, 4.2**

- [x] 1.2 Write property test for category creation with timestamps
  - **Property 2: Category creation with valid data**
  - **Validates: Requirements 1.4, 1.5, 2.1, 2.4**

- [x] 1.3 Write property test for optional description field
  - **Property 4: Optional description field**
  - **Validates: Requirements 1.3**

- [x] 2. Update MenuItem model to reference categories
  - Modify `server/models/MenuItem.js` category field from String enum to ObjectId reference
  - Change: `category: { type: String, enum: [...] }` to `category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }`
  - Update any model methods that reference category
  - _Requirements: 6.4_

- [x] 3. Create category routes and controllers
  - [x] 3.1 Create `server/routes/categories.js` with route definitions
    - GET `/api/categories` - List all categories (any authenticated user)
    - GET `/api/categories/:id` - Get single category (any authenticated user)
    - POST `/api/categories` - Create category (admin only)
    - PUT `/api/categories/:id` - Update category (admin only)
    - DELETE `/api/categories/:id` - Delete category (admin only)
    - GET `/api/categories/:id/menu-items-count` - Get menu item count (any authenticated user)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.2 Implement GET /api/categories endpoint
    - Fetch all categories from database
    - Sort alphabetically by name
    - For each category, calculate menu item count using aggregation
    - Return array with id, name, description, menuItemCount, timestamps
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.3 Implement POST /api/categories endpoint
    - Apply adminOnly middleware for authorization
    - Validate request body: name required (1-50 chars, trim whitespace), description optional (max 200 chars)
    - Sanitize name and description to prevent XSS
    - Check for duplicate name (case-insensitive)
    - Create category document
    - Return created category with 201 status
    - Handle errors: 400 for validation/duplicate, 401/403 for auth
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 11.1, 11.2, 11.3, 11.5_

  - [x] 3.4 Implement PUT /api/categories/:id endpoint
    - Apply adminOnly middleware for authorization
    - Validate category ID exists (return 404 if not)
    - Validate request body: name (1-50 chars), description (max 200 chars)
    - Sanitize input
    - Check for duplicate name excluding current category
    - Update category and updatedAt timestamp
    - Return updated category
    - Handle errors: 400 for validation/duplicate, 404 for not found, 401/403 for auth
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 11.1, 11.2, 11.3, 11.5_

  - [x] 3.5 Implement DELETE /api/categories/:id endpoint
    - Apply adminOnly middleware for authorization
    - Validate category ID exists (return 404 if not)
    - Count associated menu items using MenuItem.countDocuments({ category: id })
    - If count > 0, reject with 400 and error message including count
    - If count = 0, delete category
    - Return success message
    - Handle errors: 400 for menu items exist, 404 for not found, 401/403 for auth
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 11.1, 11.2, 11.3_

  - [x] 3.6 Implement GET /api/categories/:id endpoint
    - Fetch category by ID
    - Return 404 if not found
    - Return category with id, name, description, timestamps
    - _Requirements: 3.1_

- [x] 3.7 Write property test for empty name rejection
  - **Property 3: Empty name rejection**
  - **Validates: Requirements 2.3**

- [x] 3.8 Write property test for authorization enforcement
  - **Property 5: Authorization enforcement for category management**
  - **Validates: Requirements 2.5, 4.4, 5.4, 11.1, 11.2, 11.3**

- [x] 3.9 Write property test for category list retrieval
  - **Property 6: Category list retrieval and ordering**
  - **Validates: Requirements 3.1, 3.2**

- [x] 3.10 Write property test for category update
  - **Property 7: Category update with valid data**
  - **Validates: Requirements 4.1, 4.3**

- [x] 3.11 Write property test for invalid ID error handling
  - **Property 8: Invalid category ID error handling**
  - **Validates: Requirements 4.5, 5.5**

- [x] 3.12 Write property test for category deletion without menu items
  - **Property 9: Category deletion without menu items**
  - **Validates: Requirements 5.1, 5.3**

- [x] 3.13 Write property test for category deletion prevention
  - **Property 10: Category deletion prevention with menu items**
  - **Validates: Requirements 5.2**

- [x] 3.14 Write property test for input sanitization
  - **Property 13: Input sanitization**
  - **Validates: Requirements 11.5**

- [x] 4. Update menu item routes for category validation
  - [x] 4.1 Create category validation middleware
    - Create `validateCategory` middleware function in `server/routes/menuItems.js`
    - Check if req.body.category exists
    - Verify category ID is valid ObjectId format
    - Query Category collection to ensure category exists
    - If invalid, return 400 with error message
    - If valid, call next()
    - _Requirements: 6.1, 6.2_

  - [x] 4.2 Apply validation middleware to menu item routes
    - Add validateCategory middleware to POST /api/menu-items route
    - Add validateCategory middleware to PUT /api/menu-items/:id route
    - _Requirements: 6.1, 6.2_

  - [x] 4.3 Update menu item GET routes to populate category
    - Modify GET /api/menu-items to include `.populate('category', 'name description')`
    - Modify GET /api/menu-items/:id to include `.populate('category', 'name description')`
    - Modify GET /api/menu-items/outlet/:outletId to include `.populate('category', 'name description')`
    - _Requirements: 6.3_

- [x] 4.4 Write property test for menu item category validation
  - **Property 11: Menu item category validation**
  - **Validates: Requirements 6.1, 6.2**

- [x] 4.5 Write property test for menu item category population
  - **Property 12: Menu item category population**
  - **Validates: Requirements 6.3**

- [x] 5. Register category routes in server
  - Import category routes in `server/server.js`
  - Add route: `app.use('/api/categories', categoryRoutes);`
  - Place after other route registrations
  - _Requirements: 2.1, 3.1, 4.1, 5.1_

- [x] 6. Checkpoint - Test backend API
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create migration script
  - [x] 7.1 Create `server/scripts/migrateCategories.js`
    - Import Category and MenuItem models
    - Connect to database using existing config
    - Define hardcoded categories array: ['Main Course', 'Appetizers', 'Beverages', 'Desserts']
    - Create category documents for each hardcoded category
    - Build mapping object: { 'Main Course': categoryId1, ... }
    - Query all menu items
    - For each menu item, update category field from string to ObjectId using mapping
    - Verify all menu items have valid category references
    - Log: categories created, menu items updated, any errors
    - Close database connection
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 7.2 Add migration script to package.json
    - Add script: `"migrate:categories": "node server/scripts/migrateCategories.js"`
    - _Requirements: 10.1_

- [x] 7.3 Write unit test for migration script
  - **Property 23: Migration creates default categories**
  - **Property 24: Migration updates menu items**
  - **Property 25: Migration logging**
  - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

- [x] 8. Create CategoryManagement page component
  - [x] 8.1 Create `myapp/src/pages/CategoryManagement.jsx`
    - Set up component with Layout wrapper
    - Define state: categories, loading, error, showCreateModal, showEditModal, selectedCategory, showDeleteDialog, deleteTarget
    - Implement useEffect to fetch categories on mount
    - Create fetchCategories function: GET /api/categories
    - Render table with columns: Name, Description, Menu Items, Actions (Edit, Delete)
    - Add "Create Category" button in header
    - Handle loading and error states
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 8.2 Implement create category functionality
    - Add state for create modal visibility
    - Create handleCreateClick to show modal
    - Create handleCreateSubmit to POST /api/categories
    - On success, close modal and refresh category list
    - On error, display error message in modal
    - _Requirements: 9.2_

  - [x] 8.3 Implement edit category functionality
    - Add state for edit modal and selected category
    - Create handleEditClick to show modal with category data
    - Create handleEditSubmit to PUT /api/categories/:id
    - On success, close modal and refresh category list
    - On error, display error message in modal
    - _Requirements: 9.3_

  - [x] 8.4 Implement delete category functionality
    - Add state for delete confirmation dialog
    - Create handleDeleteClick to show confirmation dialog
    - Fetch menu item count for category
    - Display warning if menu items exist
    - Create handleDeleteConfirm to DELETE /api/categories/:id
    - On success, close dialog and refresh category list
    - On error, display error message in dialog
    - _Requirements: 9.4, 9.5_

- [x] 8.5 Write property test for category management page display
  - **Property 19: Category management page display**
  - **Validates: Requirements 9.1**

- [x] 8.6 Write property test for category management UI interactions
  - **Property 20: Category management UI interactions**
  - **Validates: Requirements 9.2, 9.3, 9.4**

- [x] 8.7 Write property test for delete warning display
  - **Property 21: Delete warning for categories with menu items**
  - **Validates: Requirements 9.5**

- [x] 9. Create CategoryForm component
  - Create `myapp/src/components/CategoryForm.jsx`
  - Accept props: initialData, onSubmit, onCancel, isEdit, loading
  - Render form with fields: name (required, max 50 chars), description (optional, max 200 chars)
  - Implement client-side validation
  - Display validation errors
  - Handle submit and cancel actions
  - _Requirements: 9.2, 9.3_

- [x] 10. Update AddMenuItem component for dynamic categories
  - [x] 10.1 Modify `myapp/src/pages/AddMenuItem.jsx`
    - Remove hardcoded categories array
    - Add state: categories, categoriesLoading, categoriesError
    - Add useEffect to fetch categories on mount: GET /api/categories
    - Update category Select component to use fetched categories
    - Map categories to options: `{ value: cat._id, label: cat.name }`
    - Handle loading state: disable select while loading
    - Handle error state: display error message with retry button
    - Handle empty state: display "No categories available" message
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

  - [x] 10.2 Update form submission to use category ID
    - Ensure formData.category contains category._id (not name)
    - Verify API call sends category ID in request body
    - _Requirements: 6.1_

- [x] 10.3 Write property test for component category loading
  - **Property 14: Component category loading**
  - **Validates: Requirements 7.1, 7.2, 8.1**

- [x] 10.4 Write property test for category dropdown display
  - **Property 15: Category dropdown display**
  - **Validates: Requirements 7.3**

- [x] 10.5 Write property test for category loading error handling
  - **Property 16: Category loading error handling**
  - **Validates: Requirements 7.4**

- [x] 11. Update EditMenuItem component for dynamic categories
  - [x] 11.1 Modify `myapp/src/pages/EditMenuItem.jsx`
    - Remove hardcoded categories array
    - Add state: categories, categoriesLoading, categoriesError
    - Add useEffect to fetch categories on mount: GET /api/categories
    - Update category Select component to use fetched categories
    - Map categories to options: `{ value: cat._id, label: cat.name }`
    - Handle loading, error, and empty states
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [x] 11.2 Update form data population
    - When loading menu item, ensure category field contains category._id
    - Handle both populated category object and category ID string
    - Set formData.category to: `menuItem.category?._id || menuItem.category`
    - _Requirements: 6.3_

- [x] 12. Update MenuBrowse component for dynamic categories
  - [x] 12.1 Modify `myapp/src/pages/MenuBrowse.jsx`
    - Remove hardcoded categories array
    - Add state: categories, categoriesLoading
    - Add useEffect to fetch categories on mount: GET /api/categories
    - Prepend "All" option to categories array: `[{ _id: 'all', name: 'All' }, ...response.data]`
    - Update category filter Select to use fetched categories
    - Map categories to options: `{ value: cat._id === 'all' ? 'All' : cat._id, label: cat.name }`
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 12.2 Update category filtering logic
    - Modify fetchMenuItems to use category ID in query params
    - Change: `if (selectedCategory !== 'All') params.category = selectedCategory;`
    - Ensure backend handles ObjectId category filtering
    - _Requirements: 8.2, 8.3_

  - [x] 12.3 Add menu item count to category filter
    - Fetch categories with menu item counts
    - Display count in filter dropdown: `{cat.name} ({cat.menuItemCount})`
    - _Requirements: 8.4_

- [x] 12.4 Write property test for category filtering behavior
  - **Property 17: Category filtering behavior**
  - **Validates: Requirements 8.2, 8.3**

- [x] 12.5 Write property test for category count display
  - **Property 18: Category menu item count display**
  - **Validates: Requirements 8.4**

- [x] 13. Add category management navigation
  - [x] 13.1 Update navigation component (Sidebar or equivalent)
    - Add "Category Management" menu item for admin users
    - Check user role: `{user.role === 'Admin' && ...}`
    - Link to: `/categories`
    - Icon: `category` or `list`
    - _Requirements: 9.1_

  - [x] 13.2 Add route for CategoryManagement page
    - Update router configuration (likely in `myapp/src/App.jsx` or routes file)
    - Add route: `<Route path="/categories" element={<CategoryManagement />} />`
    - Import CategoryManagement component
    - _Requirements: 9.1_

  - [x] 13.3 Implement frontend authorization
    - Add route guard or component-level check for admin role
    - If user is not admin, redirect to unauthorized page or dashboard
    - Display appropriate error message
    - _Requirements: 9.6_

- [x] 13.4 Write property test for frontend authorization enforcement
  - **Property 22: Frontend authorization enforcement**
  - **Validates: Requirements 9.6**

- [x] 14. Checkpoint - Test frontend integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Integration and final wiring
  - [x] 15.1 Verify all API endpoints are working
    - Test category CRUD operations via Postman or similar
    - Test menu item creation with category IDs
    - Test authorization for admin-only endpoints
    - _Requirements: All backend requirements_

  - [x] 15.2 Verify frontend components are integrated
    - Test CategoryManagement page: create, edit, delete categories
    - Test AddMenuItem: categories load and can be selected
    - Test EditMenuItem: categories load and existing category is selected
    - Test MenuBrowse: category filter works with dynamic categories
    - Test navigation: category management link appears for admins only
    - _Requirements: All frontend requirements_

  - [x] 15.3 Run migration script
    - Execute: `npm run migrate:categories`
    - Verify categories are created
    - Verify menu items are updated
    - Check logs for any errors
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 15.4 Manual end-to-end testing
    - Create a new category as admin
    - Create a menu item using the new category
    - Edit the category name
    - Verify menu item shows updated category name
    - Attempt to delete category with menu items (should fail)
    - Delete menu item
    - Delete category (should succeed)
    - Test as non-admin user (should not see category management)
    - _Requirements: All requirements_

- [x] 15.5 Write integration tests
  - Test complete category lifecycle: create → use in menu item → update → delete
  - Test authorization flow: admin access vs non-admin access
  - Test error scenarios: duplicate names, invalid IDs, deletion with menu items
  - _Requirements: All requirements_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Migration script should be run after backend is deployed but before frontend changes go live
- Consider adding database backup before running migration in production
