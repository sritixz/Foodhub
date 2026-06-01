/**
 * Feature: category-management
 * Property 20: Category management UI interactions
 * Validates: Requirements 9.2, 9.3, 9.4
 *
 * For any super admin user on the category management page:
 * - Clicking "Create Category" opens a form (9.2)
 * - Clicking "Edit" on a category opens a pre-filled form (9.3)
 * - Clicking "Delete" on a category opens a confirmation dialog (9.4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import fc from 'fast-check';
import CategoryManagement from '../pages/CategoryManagement';
import api from '../utils/api';

vi.mock('../utils/api');

vi.mock('../components/Layout/Layout', () => ({
  default: ({ children, headerProps }) => (
    <div data-testid="layout">
      {headerProps?.actionButton && (
        <div data-testid="header-actions">{headerProps.actionButton}</div>
      )}
      {children}
    </div>
  ),
}));

vi.mock('../components/UI/Button', () => ({
  default: ({ children, onClick, type, disabled, variant }) => (
    <button onClick={onClick} type={type} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('../components/UI/Card', () => ({
  default: ({ children }) => <div data-testid="card">{children}</div>,
}));

vi.mock('../components/UI/Modal', () => ({
  default: ({ isOpen, children, title, onClose }) =>
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock('../components/UI/Input', () => ({
  default: ({ label, value, onChange, required, maxLength }) => (
    <input
      aria-label={label}
      value={value}
      onChange={onChange}
      required={required}
      maxLength={maxLength}
    />
  ),
}));

const categoryArb = fc.record({
  _id: fc.uuid(),
  name: fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,48}$/)
    .filter((s) => s.trim().length > 0),
  description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: '' }),
  menuItemCount: fc.nat({ max: 50 }),
});

const renderPage = () =>
  render(
    <BrowserRouter>
      <CategoryManagement />
    </BrowserRouter>
  );

describe('Feature: category-management, Property 20: Category management UI interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 9.2 — Clicking "Create Category" opens a form
   */
  it('should open create category form when Create Category button is clicked', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 0, maxLength: 5 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockResolvedValue({ data: categories });

          const { unmount } = renderPage();

          await waitFor(() => {
            expect(screen.getByText(/create category/i)).toBeInTheDocument();
          });

          // Modal should not be visible yet
          expect(screen.queryByRole('dialog', { name: /create category/i })).toBeNull();

          // Click the create button
          fireEvent.click(screen.getByText(/create category/i));

          // Modal should now be visible with the form
          await waitFor(() => {
            expect(screen.getByRole('dialog', { name: /create category/i })).toBeInTheDocument();
          });

          // Form fields should be empty (fresh form)
          const nameInput = screen.getByRole('dialog', { name: /create category/i })
            .querySelector('input[aria-label="Category Name"]');
          expect(nameInput).not.toBeNull();
          expect(nameInput.value).toBe('');

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Requirement 9.3 — Clicking "Edit" opens a pre-filled form
   */
  it('should open edit form pre-filled with category data when edit button is clicked', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockResolvedValue({ data: categories });

          const { unmount } = renderPage();

          await waitFor(() => {
            expect(screen.getAllByTitle('Edit category').length).toBeGreaterThan(0);
          });

          // Pick the first category's edit button
          const editButtons = screen.getAllByTitle('Edit category');
          fireEvent.click(editButtons[0]);

          const targetCategory = categories[0];

          await waitFor(() => {
            expect(screen.getByRole('dialog', { name: /edit category/i })).toBeInTheDocument();
          });

          // Name input should be pre-filled with the category's name
          const nameInput = screen.getByRole('dialog', { name: /edit category/i })
            .querySelector('input[aria-label="Category Name"]');
          expect(nameInput).not.toBeNull();
          expect(nameInput.value).toBe(targetCategory.name);

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Requirement 9.4 — Clicking "Delete" opens a confirmation dialog
   */
  it('should open delete confirmation dialog when delete button is clicked', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockResolvedValue({ data: categories });

          const { unmount } = renderPage();

          await waitFor(() => {
            expect(screen.getAllByTitle('Delete category').length).toBeGreaterThan(0);
          });

          // No delete dialog visible yet
          expect(screen.queryByRole('dialog', { name: /delete category/i })).toBeNull();

          const deleteButtons = screen.getAllByTitle('Delete category');
          fireEvent.click(deleteButtons[0]);

          await waitFor(() => {
            expect(screen.getByRole('dialog', { name: /delete category/i })).toBeInTheDocument();
          });

          // Confirmation dialog should contain the category name
          const dialog = screen.getByRole('dialog', { name: /delete category/i });
          expect(dialog.textContent).toContain(categories[0].name);

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Requirement 9.2 — Submitting the create form calls POST /categories
   */
  it('should call POST /categories when create form is submitted with a valid name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,48}$/).filter((s) => s.trim().length > 0),
        async (newName) => {
          vi.clearAllMocks();
          api.get.mockResolvedValue({ data: [] });
          api.post.mockResolvedValue({ data: { _id: 'new-id', name: newName, menuItemCount: 0 } });

          const { unmount, getByText, getByRole } = renderPage();

          await waitFor(() => {
            expect(getByText(/create category/i)).toBeInTheDocument();
          });

          fireEvent.click(getByText(/create category/i));

          await waitFor(() => {
            expect(getByRole('dialog', { name: /create category/i })).toBeInTheDocument();
          });

          const nameInput = getByRole('dialog', { name: /create category/i })
            .querySelector('input[aria-label="Category Name"]');

          fireEvent.change(nameInput, { target: { value: newName } });

          const submitButton = getByRole('dialog', { name: /create category/i })
            .querySelector('button[type="submit"]');
          fireEvent.click(submitButton);

          await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
              '/categories',
              expect.objectContaining({ name: newName })
            );
          });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Requirement 9.3 — Submitting the edit form calls PUT /categories/:id
   */
  it('should call PUT /categories/:id when edit form is submitted with a valid name', async () => {
    await fc.assert(
      fc.asyncProperty(
        categoryArb,
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,48}$/).filter((s) => s.trim().length > 0),
        async (category, updatedName) => {
          vi.clearAllMocks();
          api.get.mockResolvedValue({ data: [category] });
          api.put.mockResolvedValue({
            data: { ...category, name: updatedName },
          });

          const { unmount } = renderPage();

          await waitFor(() => {
            expect(screen.getByTitle('Edit category')).toBeInTheDocument();
          });

          fireEvent.click(screen.getByTitle('Edit category'));

          await waitFor(() => {
            expect(screen.getByRole('dialog', { name: /edit category/i })).toBeInTheDocument();
          });

          const nameInput = screen.getByRole('dialog', { name: /edit category/i })
            .querySelector('input[aria-label="Category Name"]');

          fireEvent.change(nameInput, { target: { value: updatedName } });

          const submitButton = screen.getByText(/^update category$/i);
          fireEvent.click(submitButton);

          await waitFor(() => {
            expect(api.put).toHaveBeenCalledWith(
              `/categories/${category._id}`,
              expect.objectContaining({ name: updatedName })
            );
          });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);

  /**
   * Requirement 9.4 — Confirming delete calls DELETE /categories/:id
   */
  it('should call DELETE /categories/:id when delete is confirmed for a category with no menu items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          _id: fc.uuid(),
          name: fc
            .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,48}$/)
            .filter((s) => s.trim().length > 0),
          description: fc.constant(''),
          menuItemCount: fc.constant(0),
        }),
        async (category) => {
          vi.clearAllMocks();
          api.get.mockResolvedValue({ data: [category] });
          api.delete.mockResolvedValue({ data: { message: 'Deleted' } });

          const { unmount, getAllByTitle, getByRole } = renderPage();

          await waitFor(() => {
            expect(getAllByTitle('Delete category').length).toBeGreaterThan(0);
          });

          fireEvent.click(getAllByTitle('Delete category')[0]);

          await waitFor(() => {
            expect(getByRole('dialog', { name: /delete category/i })).toBeInTheDocument();
          });

          // Click the Delete confirm button (not Cancel) — scoped to the dialog
          const dialog = getByRole('dialog', { name: /delete category/i });
          const deleteConfirmBtn = Array.from(dialog.querySelectorAll('button'))
            .find((btn) => /^delete$/i.test(btn.textContent.trim()));
          expect(deleteConfirmBtn).not.toBeUndefined();
          fireEvent.click(deleteConfirmBtn);

          await waitFor(() => {
            expect(api.delete).toHaveBeenCalledWith(`/categories/${category._id}`);
          });

          unmount();
        }
      ),
      { numRuns: 5 }
    );
  }, 60000);
});
