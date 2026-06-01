/**
 * Feature: category-management
 * Property 18: Category menu item count display
 * Validates: Requirements 8.4
 *
 * For any category in the filter dropdown, the component should display
 * the count of menu items in that category alongside the category name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import fc from 'fast-check';
import MenuBrowse from '../pages/MenuBrowse';
import api from '../utils/api';

vi.mock('../utils/api');

vi.mock('../components/Layout/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('../components/UI/Button', () => ({
  default: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../components/UI/Card', () => ({
  default: ({ children }) => <div data-testid="card">{children}</div>,
}));

vi.mock('../components/UI/Input', () => ({
  default: ({ placeholder, value, onChange, type, className }) => (
    <input
      placeholder={placeholder}
      value={value ?? ''}
      onChange={onChange}
      type={type}
      className={className}
    />
  ),
}));

vi.mock('../components/UI/Select', () => ({
  default: ({ value, onChange, options, disabled, className }) => (
    <select
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      className={className}
      data-testid="category-select"
    >
      {Array.isArray(options) &&
        options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
    </select>
  ),
}));

// Arbitrary for a single category with a known menuItemCount
// Names use a simple pattern: letter followed by alphanumeric chars (no spaces)
// to avoid whitespace normalization issues in rendered labels
const categoryArb = fc.record({
  _id: fc.uuid(),
  name: fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9]{1,20}$/)
    .filter((s) => s.length > 0),
  menuItemCount: fc.nat({ max: 50 }),
});

const renderMenuBrowse = () =>
  render(
    <BrowserRouter>
      <MenuBrowse />
    </BrowserRouter>
  );

describe('Feature: category-management, Property 18: Category menu item count display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 8.4 — Each category option in the filter dropdown should show
   * the menu item count alongside the category name, e.g. "Beverages (3)".
   * For any set of categories returned by the API, every non-"All" option
   * in the dropdown must include the count in its label.
   */
  it('should display menu item count in each category option label', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 6 }),
        async (categories) => {
          // Deduplicate by _id to avoid React key warnings
          const unique = categories.filter(
            (cat, idx, arr) => arr.findIndex((c) => c._id === cat._id) === idx
          );

          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: unique });
            if (url === '/menu-items') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderMenuBrowse();

          // Wait for categories to be loaded into the select
          await waitFor(() => {
            const select = container.querySelector('[data-testid="category-select"]');
            expect(select).not.toBeNull();
            // At minimum the "All" option plus the fetched categories
            expect(select.options.length).toBeGreaterThan(1);
          });

          const select = container.querySelector('[data-testid="category-select"]');
          const options = Array.from(select.options);

          // Every category (non-"All") should have its count in the label
          for (const cat of unique) {
            const matchingOption = options.find((opt) => opt.value === cat._id);
            expect(matchingOption).toBeDefined();
            expect(matchingOption.text).toContain(cat.name);
            expect(matchingOption.text).toContain(`(${cat.menuItemCount})`);
          }

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  }, 60000);

  /**
   * Requirement 8.4 — The "All" option should not display a count.
   * For any set of categories, the "All" option label should simply be "All".
   */
  it('should not display a count for the "All" option', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/menu-items') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderMenuBrowse();

          await waitFor(() => {
            const select = container.querySelector('[data-testid="category-select"]');
            expect(select).not.toBeNull();
            expect(select.options.length).toBeGreaterThan(0);
          });

          const select = container.querySelector('[data-testid="category-select"]');
          const allOption = Array.from(select.options).find((opt) => opt.value === 'All');
          expect(allOption).toBeDefined();
          expect(allOption.text).toBe('All');

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);
});
