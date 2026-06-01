/**
 * Feature: category-management
 * Property 15: Category dropdown display
 * Validates: Requirements 7.3
 *
 * For any set of categories loaded from the API, the frontend components
 * should display them in a dropdown selector with the category name as the
 * label and category ID as the value.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
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

// Arbitrary for a single category with realistic shape
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

describe('Feature: category-management, Property 15: Category dropdown display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 7.3 — Each category option uses category._id as value
   * For any set of categories returned by the API, every option in the
   * category dropdown must have its value set to the category's _id.
   */
  it('should use category _id as the option value for every category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 8 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/outlets') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderAddMenuItem();

          await waitFor(() => {
            const select = container.querySelector('[data-testid="select-Category"]');
            expect(select).not.toBeNull();
            categories.forEach((cat) => {
              const option = select.querySelector(`option[value="${cat._id}"]`);
              expect(option).not.toBeNull();
            });
          });

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  }, 60000);

  /**
   * Requirement 7.3 — Each category option uses category.name as the label
   * For any set of categories returned by the API, every option in the
   * category dropdown must display the category's name as its text content.
   */
  it('should use category name as the option label for every category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 8 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/outlets') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderAddMenuItem();

          await waitFor(() => {
            const select = container.querySelector('[data-testid="select-Category"]');
            expect(select).not.toBeNull();
            categories.forEach((cat) => {
              const option = select.querySelector(`option[value="${cat._id}"]`);
              expect(option).not.toBeNull();
              expect(option.textContent).toBe(cat.name);
            });
          });

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  }, 60000);

  /**
   * Requirement 7.3 — Dropdown option count matches the number of categories
   * For any set of N categories, the dropdown should contain exactly N category
   * options (plus any placeholder option).
   */
  it('should render exactly as many options as categories returned by the API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 0, maxLength: 10 }),
        async (categories) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.resolve({ data: categories });
            if (url === '/outlets') return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
          });

          const { unmount, container } = renderAddMenuItem();

          await waitFor(() => {
            const select = container.querySelector('[data-testid="select-Category"]');
            expect(select).not.toBeNull();
            // Count only options whose value matches a category _id
            const categoryOptionValues = categories.map((c) => c._id);
            const renderedOptions = Array.from(select.querySelectorAll('option')).filter(
              (opt) => categoryOptionValues.includes(opt.value)
            );
            expect(renderedOptions).toHaveLength(categories.length);
          });

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  }, 60000);
});
