/**
 * Feature: category-management
 * Property 16: Category loading error handling
 * Validates: Requirements 7.4
 *
 * When the category list fails to load, the Frontend_Components SHALL display
 * an error message and provide a retry option.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// Arbitrary for error messages that the API might throw
const errorArb = fc.record({
  message: fc.string({ minLength: 1, maxLength: 100 }),
  status: fc.integer({ min: 400, max: 599 }),
});

const categoryArb = fc.record({
  _id: fc.uuid(),
  name: fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,30}$/)
    .filter((s) => s.trim().length > 0),
  menuItemCount: fc.nat({ max: 50 }),
});

const renderAddMenuItem = () =>
  render(
    <BrowserRouter>
      <AddMenuItem />
    </BrowserRouter>
  );

describe('Feature: category-management, Property 16: Category loading error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 7.4 — Error message is displayed when category fetch fails
   * For any API error, the component should display an error message to the user.
   */
  it('should display an error message when the category API call fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        errorArb,
        async (error) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.reject(new Error(error.message));
            return Promise.resolve({ data: [] });
          });

          const { unmount } = renderAddMenuItem();

          await waitFor(() => {
            expect(screen.getByText('Failed to load categories')).toBeTruthy();
          });

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Requirement 7.4 — Retry button is displayed when category fetch fails
   * For any API error, the component should provide a retry option.
   */
  it('should display a retry button when the category API call fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        errorArb,
        async (error) => {
          vi.clearAllMocks();
          api.get.mockImplementation((url) => {
            if (url === '/categories') return Promise.reject(new Error(error.message));
            return Promise.resolve({ data: [] });
          });

          const { unmount } = renderAddMenuItem();

          await waitFor(() => {
            expect(screen.getByText('Retry')).toBeTruthy();
          });

          unmount();
        }
      ),
      { numRuns: 10 }
    );
  }, 60000);

  /**
   * Requirement 7.4 — Retry re-fetches categories from the API
   * When the user clicks the retry button after a failure, the component
   * should attempt to fetch categories again.
   */
  it('should re-fetch categories when the retry button is clicked', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
        async (categories) => {
          vi.clearAllMocks();
          let callCount = 0;
          api.get.mockImplementation((url) => {
            if (url === '/categories') {
              callCount++;
              // First call fails, second call (retry) succeeds
              if (callCount === 1) return Promise.reject(new Error('Network error'));
              return Promise.resolve({ data: categories });
            }
            return Promise.resolve({ data: [] });
          });

          const { unmount } = renderAddMenuItem();

          // Wait for error state
          await waitFor(() => {
            expect(screen.getByText('Retry')).toBeTruthy();
          });

          // Click retry
          fireEvent.click(screen.getByText('Retry'));

          // After retry, categories should load and error should disappear
          await waitFor(() => {
            expect(screen.queryByText('Failed to load categories')).toBeNull();
          });

          // Verify the API was called at least twice (initial + retry)
          const categoryCalls = api.get.mock.calls.filter((c) => c[0] === '/categories');
          expect(categoryCalls.length).toBeGreaterThanOrEqual(2);

          unmount();
        }
      ),
      { numRuns: 8 }
    );
  }, 60000);
});
