/**
 * Feature: category-management
 * Property 14: Component category loading
 * Validates: Requirements 7.1, 7.2, 8.1
 *
 * For any of the menu-related components (AddMenuItem, EditMenuItem, MenuBrowse),
 * when the component mounts, it should fetch the current category list from the
 * Backend API and populate the category selector.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import fc from 'fast-check';
import AddMenuItem from '../pages/AddMenuItem';
import api from '../utils/api';

vi.mock('../utils/api');

vi.mock('../components/Layout/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('../components/UI/Button', () => ({
  default: ({ children, onClick, type, disabled }) => (
    <button onClick={onClick} type={type} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('../components/UI/Card', () => ({
  default: ({ children }) => <div data-testid="card">{children}</div>,
}));

vi.mock('../components/UI/Input', () => ({
  default: ({ label, value, onChange, ...rest }) => (
    <input aria-label={label} value={value ?? ''} onChange={onChange} {...rest} />
  ),
}));

vi.mock('../components/UI/Select', () => ({
  default: ({ label, value, onChange, options, placeholder, disabled }) => (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      data-testid={`select-${label}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
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

vi.mock('../components/ImageUpload', () => ({
  default: () => <div data-testid="image-upload" />,
}));

const categoryArb = fc.record({
  _id: fc.uuid(),
  name: fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,30}$/)
    .filter((s) => s.trim().length > 0),
  description: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: '' }),
  menuItemCount: fc.nat({ max: 50 }),
});

const renderAddMenuItem = () =>
  render(
    <BrowserRouter>
      <AddMenuItem />
    </BrowserRouter>
  );

describe('Feature: category-management, Property 14: Component category loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 7.1 — AddMenuItem fetches categories on mount
   * For any set of categories returned by the API, the AddMenuItem component
   * should call GET /categories when it mounts.
   */
  it('should call GET /categories when AddMenuItem mounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 0, maxLength: 8 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/outlets') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount } = renderAddMenuItem();

          await waitFor(() => {
            const calls = api.get.mock.calls.map((c) => c[0]);
            expect(calls).toContain('/categories');
          });

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Requirement 7.1 — AddMenuItem populates category selector with fetched categories
   * For any non-empty set of categories, the category select element should contain
   * an option for each category returned by the API.
   */
  it('should populate the category selector with categories from the API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 6 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/outlets') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderAddMenuItem();

          await waitFor(() => {
            const categorySelect = container.querySelector('[data-testid="select-Category"]');
            expect(categorySelect).not.toBeNull();
            categories.forEach((cat) => {
              const option = categorySelect.querySelector(`option[value="${cat._id}"]`);
              expect(option).not.toBeNull();
              expect(option.textContent).toBe(cat.name);
            });
          });

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Requirement 7.1 — Category selector is disabled while loading
   * The category select should be disabled while the API call is in flight.
   */
  it('should disable the category selector while categories are loading', async () => {
    let resolveCategories;
    const pendingPromise = new Promise((resolve) => {
      resolveCategories = resolve;
    });

    api.get.mockImplementation((url) => {
      if (url === '/categories') return pendingPromise;
      return Promise.resolve({ data: [] });
    });

    const { container, unmount } = renderAddMenuItem();

    // While loading, the select should be disabled
    const categorySelect = container.querySelector('[data-testid="select-Category"]');
    expect(categorySelect).not.toBeNull();
    expect(categorySelect.disabled).toBe(true);

    // Resolve the promise to clean up
    resolveCategories({ data: [] });
    unmount();
  });

  /**
   * Requirement 7.1 — Category selector is enabled after loading completes
   * For any set of categories, once the API call resolves, the selector should be enabled.
   */
  it('should enable the category selector after categories finish loading', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 0, maxLength: 5 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/outlets') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderAddMenuItem();

          await waitFor(() => {
            const categorySelect = container.querySelector('[data-testid="select-Category"]');
            expect(categorySelect).not.toBeNull();
            expect(categorySelect.disabled).toBe(false);
          });

          unmount();
        }
      ),
      { numRuns: 8 }
    );
  }, 60000);
});
