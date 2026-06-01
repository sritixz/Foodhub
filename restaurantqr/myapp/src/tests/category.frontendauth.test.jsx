/**
 * Feature: category-management
 * Property 22: Frontend authorization enforcement
 * Validates: Requirements 9.6
 *
 * For any non-super-admin user attempting to access the category management
 * page, the frontend should either redirect to an unauthorized page or hide
 * the category management options from the navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fc from 'fast-check';
import ProtectedRoute from '../components/ProtectedRoute';
import CategoryManagement from '../pages/CategoryManagement';

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
  default: {},
}));

// Mock api to prevent real network calls if CategoryManagement renders
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Minimal mocks for CategoryManagement sub-components
vi.mock('../components/Layout/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('../components/UI/Button', () => ({
  default: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}));
vi.mock('../components/UI/Card', () => ({
  default: ({ children }) => <div data-testid="card">{children}</div>,
}));
vi.mock('../components/UI/Modal', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div>{children}</div> : null),
}));
vi.mock('../components/UI/Input', () => ({
  default: ({ label, value, onChange }) => (
    <input aria-label={label} value={value} onChange={onChange} />
  ),
}));

import { useAuth } from '../context/AuthContext';

// Non-admin roles that should be blocked
const NON_ADMIN_ROLES = ['Company Admin', 'Vendor', 'Delivery Staff', 'Customer', 'Staff'];

const renderWithAuth = (authValue) =>
  render(
    <MemoryRouter initialEntries={['/categories']}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        <Route
          path="/categories"
          element={
            <ProtectedRoute allowedRoles={['Admin']}>
              <CategoryManagement />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('Feature: category-management, Property 22: Frontend authorization enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Unauthenticated users should be redirected to /login
   */
  it('should redirect unauthenticated users to the login page', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
    });

    renderWithAuth();

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('layout')).toBeNull();
  });

  /**
   * For any non-admin role, the category management page should be blocked
   */
  it('should show Access Denied for any non-admin authenticated user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...NON_ADMIN_ROLES),
        async (role) => {
          vi.clearAllMocks();
          useAuth.mockReturnValue({
            isAuthenticated: true,
            user: { _id: 'user-1', name: 'Test User', role },
            loading: false,
          });

          const { unmount } = renderWithAuth();

          await waitFor(() => {
            expect(screen.getByText(/access denied/i)).toBeInTheDocument();
          });

          // CategoryManagement content should NOT be rendered
          expect(screen.queryByTestId('layout')).toBeNull();

          unmount();
        }
      ),
      { numRuns: NON_ADMIN_ROLES.length }
    );
  }, 30000);

  /**
   * Admin users should be allowed through to the CategoryManagement page
   */
  it('should allow Admin users to access the category management page', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { _id: 'admin-1', name: 'Admin User', role: 'Admin' },
      loading: false,
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.queryByText(/access denied/i)).toBeNull();
      expect(screen.queryByTestId('login-page')).toBeNull();
    });
  });

  /**
   * While auth is loading, neither the page nor access denied should flash
   */
  it('should show a loading state while authentication is being determined', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: true,
    });

    renderWithAuth();

    // Should not show the category management page or access denied during loading
    expect(screen.queryByTestId('layout')).toBeNull();
    expect(screen.queryByText(/access denied/i)).toBeNull();
    expect(screen.queryByTestId('login-page')).toBeNull();
  });

  /**
   * Property: for any combination of non-admin role and arbitrary user data,
   * the category management page must never be accessible.
   */
  it('should never render CategoryManagement content for non-admin users regardless of user data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...NON_ADMIN_ROLES),
        fc.record({
          _id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.string({ minLength: 5, maxLength: 50 }),
        }),
        async (role, userData) => {
          vi.clearAllMocks();
          useAuth.mockReturnValue({
            isAuthenticated: true,
            user: { ...userData, role },
            loading: false,
          });

          const { unmount } = renderWithAuth();

          await waitFor(() => {
            // Must show access denied
            expect(screen.getByText(/access denied/i)).toBeInTheDocument();
          });

          // The actual category management UI must not be visible
          expect(screen.queryByText(/create category/i)).toBeNull();

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});
