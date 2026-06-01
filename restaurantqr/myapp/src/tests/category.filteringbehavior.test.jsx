/**
 * Feature: category-management
 * Property 17: Category filtering behavior
 * Validates: Requirements 8.2, 8.3
 *
 * For any category selected in the MenuBrowse filter, the component should
 * pass only that category's ID as a query param when fetching menu items.
 * When "All" is selected, no category filter should be applied.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
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

// Arbitrary for a single category
const categoryArb = fc.record({
  _id: fc.uuid(),
  name: fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,20}$/)
    .filter((s) => s.trim().length > 0),
  menuItemCount: fc.nat({ max: 20 }),
});

const renderMenuBrowse = () =>
  render(
    <BrowserRouter>
      <MenuBrowse />
    </BrowserRouter>
  );

describe('Feature: category-management, Property 17: Category filtering behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 8.3 — When "All" is selected, no category param is sent
   * For any set of categories, when the filter is "All", the menu items
   * fetch should NOT include a category query parameter.
   */
  it('should not include category param when "All" is selected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 6 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/menu-items') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount } = renderMenuBrowse();

          // Wait for initial load (selectedCategory defaults to 'All')
          await waitFor(() => {
            const menuItemCalls = api.get.mock.calls.filter((c) => c[0] === '/menu-items');
            expect(menuItemCalls.length).toBeGreaterThan(0);
          });

          const menuItemCalls = api.get.mock.calls.filter((c) => c[0] === '/menu-items');
          const lastCall = menuItemCalls[menuItemCalls.length - 1];
          const params = lastCall[1]?.params ?? {};
          expect(params.category).toBeUndefined();

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Requirement 8.2 — When a specific category is selected, its ID is sent as a param
   * For any category in the list, when the user selects it in the filter dropdown,
   * the menu items fetch should include that category's _id as the category param.
   */
  it('should include the selected category ID as a query param when a category is chosen', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
        fc.nat(),
        async (categories, indexSeed) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/menu-items') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderMenuBrowse();

          // Wait for categories to load
          await waitFor(() => {
            const selects = container.querySelectorAll('[data-testid="category-select"]');
            expect(selects.length).toBeGreaterThan(0);
          });

          const categorySelect = container.querySelector('[data-testid="category-select"]');
          const pickedCategory = categories[indexSeed % categories.length];

          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/menu-items') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          // Select a specific category
          fireEvent.change(categorySelect, { target: { value: pickedCategory._id } });

          await waitFor(() => {
            const menuItemCalls = api.get.mock.calls.filter((c) => c[0] === '/menu-items');
            expect(menuItemCalls.length).toBeGreaterThan(0);
          });

          const menuItemCalls = api.get.mock.calls.filter((c) => c[0] === '/menu-items');
          const lastCall = menuItemCalls[menuItemCalls.length - 1];
          const params = lastCall[1]?.params ?? {};
          expect(params.category).toBe(pickedCategory._id);

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Requirement 8.2 & 8.3 — Each category in the filter maps to the correct API param
   * For any set of categories, each category option in the filter should map
   * to that category's _id as the query param, and "All" maps to no param.
   * Tests multiple independent category selections to verify consistent behavior.
   */
  it('should correctly map each category option to its ID in the API request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 2, maxLength: 5 }),
        fc.nat(),
        async (categories, indexSeed) => {
          // Ensure unique IDs to avoid React key warnings
          const uniqueCategories = categories.filter(
            (cat, idx, arr) => arr.findIndex((c) => c._id === cat._id) === idx
          );
          if (uniqueCategories.length < 2) return;

          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: uniqueCategories });
            if (url === '/menu-items') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderMenuBrowse();

          // Wait for initial load — "All" selected, no category param
          await waitFor(() => {
            const calls = api.get.mock.calls.filter((c) => c[0] === '/menu-items');
            expect(calls.length).toBeGreaterThan(0);
            expect(calls[calls.length - 1][1]?.params?.category).toBeUndefined();
          });

          // Pick a category and verify its ID is sent as the param
          const pickedCategory = uniqueCategories[indexSeed % uniqueCategories.length];
          const categorySelect = container.querySelector('[data-testid="category-select"]');

          fireEvent.change(categorySelect, { target: { value: pickedCategory._id } });

          await waitFor(() => {
            const calls = api.get.mock.calls.filter((c) => c[0] === '/menu-items');
            expect(calls.some((c) => c[1]?.params?.category === pickedCategory._id)).toBe(true);
          });

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 90000);
});
