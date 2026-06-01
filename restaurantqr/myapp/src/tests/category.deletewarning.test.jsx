/**
 * Feature: category-management
 * Property 21: Delete warning for categories with menu items
 * Validates: Requirements 9.5
 *
 * For any category that has associated menu items (menuItemCount > 0),
 * the delete confirmation dialog MUST display a warning showing the
 * number of affected menu items.
 *
 * For categories with no menu items, no such warning should appear.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const renderPage = () =>
  render(
    <BrowserRouter>
      <CategoryManagement />
    </BrowserRouter>
  );

// Arbitrary for a category with at least 1 menu item
const categoryWithItemsArb = fc.record({
  _id: fc.uuid(),
  name: fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,48}$/)
    .filter((s) => s.trim().length > 0),
  description: fc.constant(''),
  menuItemCount: fc.integer({ min: 1, max: 100 }),
});

// Arbitrary for a category with no menu items
const categoryWithoutItemsArb = fc.record({
  _id: fc.uuid(),
  name: fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,48}$/)
    .filter((s) => s.trim().length > 0),
  description: fc.constant(''),
  menuItemCount: fc.constant(0),
});

describe('Feature: category-management, Property 21: Delete warning for categories with menu items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 9.5 — Warning shown when category has menu items
   *
   * For any category with menuItemCount > 0, clicking Delete must show
   * a warning in the confirmation dialog that includes the item count.
   */
  it('should display a warning with the menu item count when deleting a category that has menu items', async () => {
    await fc.assert(
      fc.asyncProperty(categoryWithItemsArb, async (category) => {
        vi.clearAllMocks();
        api.get.mockResolvedValue({ data: [category] });

        const { unmount } = renderPage();

        await waitFor(() => {
          expect(screen.getAllByTitle('Delete category').length).toBeGreaterThan(0);
        });

        fireEvent.click(screen.getAllByTitle('Delete category')[0]);

        await waitFor(() => {
          expect(
            screen.getByRole('dialog', { name: /delete category/i })
          ).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog', { name: /delete category/i });

        // Warning must be visible
        expect(dialog.textContent).toMatch(/warning/i);

        // The exact count must appear in the warning
        expect(dialog.textContent).toContain(String(category.menuItemCount));

        unmount();
      }),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Requirement 9.5 (inverse) — No warning when category has no menu items
   *
   * For any category with menuItemCount === 0, the delete dialog must NOT
   * show the warning about affected menu items.
   */
  it('should NOT display a warning when deleting a category that has no menu items', async () => {
    await fc.assert(
      fc.asyncProperty(categoryWithoutItemsArb, async (category) => {
        vi.clearAllMocks();
        api.get.mockResolvedValue({ data: [category] });

        const { unmount } = renderPage();

        await waitFor(() => {
          expect(screen.getAllByTitle('Delete category').length).toBeGreaterThan(0);
        });

        fireEvent.click(screen.getAllByTitle('Delete category')[0]);

        await waitFor(() => {
          expect(
            screen.getByRole('dialog', { name: /delete category/i })
          ).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog', { name: /delete category/i });

        // No warning block should be present
        expect(dialog.textContent).not.toMatch(/warning/i);

        unmount();
      }),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Requirement 9.5 — Delete button is disabled when category has menu items
   *
   * The Delete confirm button must be disabled to prevent accidental deletion
   * when the category still has associated menu items.
   */
  it('should disable the Delete button when the category has menu items', async () => {
    await fc.assert(
      fc.asyncProperty(categoryWithItemsArb, async (category) => {
        vi.clearAllMocks();
        api.get.mockResolvedValue({ data: [category] });

        const { unmount } = renderPage();

        await waitFor(() => {
          expect(screen.getAllByTitle('Delete category').length).toBeGreaterThan(0);
        });

        fireEvent.click(screen.getAllByTitle('Delete category')[0]);

        await waitFor(() => {
          expect(
            screen.getByRole('dialog', { name: /delete category/i })
          ).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog', { name: /delete category/i });
        const deleteBtn = Array.from(dialog.querySelectorAll('button')).find((btn) =>
          /^delete$/i.test(btn.textContent.trim())
        );

        expect(deleteBtn).not.toBeUndefined();
        expect(deleteBtn.disabled).toBe(true);

        unmount();
      }),
      { numRuns: 10 }
    );
  }, 60000);
});
