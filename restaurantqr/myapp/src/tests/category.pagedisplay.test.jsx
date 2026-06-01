/**
 * Feature: category-management
 * Property 19: Category management page display
 * Validates: Requirements 9.1
 *
 * For any super admin user navigating to the category management page,
 * the page should display a list of all categories with their names,
 * descriptions, and menu item counts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import fc from 'fast-check';
import CategoryManagement from '../pages/CategoryManagement';
import api from '../utils/api';

vi.mock('../utils/api');

vi.mock('../components/Layout/Layout', () => ({
  default: ({ children, headerProps }) => (
    <div data-testid="layout">
      {headerProps?.actionButton && <div data-testid="header-actions">{headerProps.actionButton}</div>}
      {children}
    </div>
  ),
}));

vi.mock('../components/UI/Button', () => ({
  default: ({ children, onClick, type, disabled }) => (
    <button onClick={onClick} type={type} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('../components/UI/Card', () => ({
  default: ({ children }) => <div data-testid="card">{children}</div>,
}));

vi.mock('../components/UI/Modal', () => ({
  default: ({ isOpen, children, title }) =>
    isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));

vi.mock('../components/UI/Input', () => ({
  default: ({ label, value, onChange, ...rest }) => (
    <input aria-label={label} value={value} onChange={onChange} {...rest} />
  ),
}));

const renderPage = () =>
  render(
    <BrowserRouter>
      <CategoryManagement />
    </BrowserRouter>
  );

describe('Feature: category-management, Property 19: Category management page display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display all category names from the API response', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            _id: fc.uuid(),
            name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,48}$/).filter(s => s.trim().length > 0),
            description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: '' }),
            menuItemCount: fc.nat({ max: 100 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockResolvedValue({ data: categories });

          const { unmount, container } = renderPage();

          await waitFor(() => {
            categories.forEach((cat) => {
              // Query within the current render container to avoid stale DOM
              const found = container.querySelector(`h4`);
              expect(found).not.toBeNull();
              const allH4s = Array.from(container.querySelectorAll('h4'));
              const match = allH4s.some(el => el.textContent.trim() === cat.name.trim());
              expect(match).toBe(true);
            });
          });

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  it('should display menu item counts for each category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            _id: fc.uuid(),
            name: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,48}$/).filter(s => s.trim().length > 0),
            description: fc.constant(''),
            menuItemCount: fc.nat({ max: 99 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockResolvedValue({ data: categories });

          const { unmount } = renderPage();

          await waitFor(() => {
            categories.forEach((cat) => {
              const matches = screen.getAllByText(String(cat.menuItemCount));
              expect(matches.length).toBeGreaterThan(0);
            });
          });

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  it('should display empty state message when no categories exist', async () => {
    api.get.mockResolvedValue({ data: [] });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/no categories found/i)
      ).toBeInTheDocument();
    });
  });

  it('should display the table headers: Name, Description, Menu Items, Actions', async () => {
    api.get.mockResolvedValue({ data: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Menu Items')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('should show a Create Category button', async () => {
    api.get.mockResolvedValue({ data: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/create category/i)).toBeInTheDocument();
    });
  });
});
