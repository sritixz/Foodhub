import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import OrderPlacement from '../pages/OrderPlacement';
import api from '../utils/api';

vi.mock('../utils/api');
vi.mock('../components/Layout/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>
}));
vi.mock('../components/Layout/Header', () => ({
  default: ({ title, searchPlaceholder, searchValue, onSearchChange }) => (
    <div data-testid="header">
      <h1>{title}</h1>
      <input 
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={onSearchChange}
        data-testid="header-search"
      />
    </div>
  )
}));

describe('OrderPlacement Component', () => {
  const mockUser = {
    _id: 'user123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'Employee',
  };

  const mockMenuItems = [
    {
      _id: 'item1',
      name: 'Burger',
      category: 'Main Course',
      foodType: 'Non-Veg',
      basePrice: 150,
      status: 'Available',
      vendor: { _id: 'outlet123' },
      image: 'https://example.com/burger.jpg',
    },
    {
      _id: 'item2',
      name: 'Pizza',
      category: 'Main Course',
      foodType: 'Veg',
      basePrice: 200,
      status: 'Available',
      vendor: { _id: 'outlet123' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: mockMenuItems });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <OrderPlacement />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('should render order placement page', async () => {
    renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText('Place Order')).toBeInTheDocument();
    });
  });

  it('should fetch and display menu items', async () => {
    renderComponent();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });
  });

  it('should add item to cart when Add button is clicked', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Cart')).toBeInTheDocument();
      expect(screen.getAllByText('Burger').length).toBeGreaterThan(1);
    });
  });

  it('should update cart quantity', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    // Add item to cart
    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      // Find increment button by "add" icon text
      const incrementButtons = screen.getAllByText('add');
      fireEvent.click(incrementButtons[0].closest('button'));
    });

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should remove item from cart', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    // Add item to cart
    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText('Remove item');
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    });
  });

  it('should calculate cart total correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    // Add items to cart
    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]); // Burger - 150
    fireEvent.click(addButtons[1]); // Pizza - 200

    await waitFor(() => {
      expect(screen.getByText('₹350.00')).toBeInTheDocument();
    });
  });

  it('should validate delivery address before checkout', async () => {
    api.post.mockResolvedValue({ data: { _id: 'order123' } });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    // Add item to cart
    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      const checkoutButton = screen.getByRole('button', { name: 'Place Order' });
      fireEvent.click(checkoutButton);
    });

    // Should show validation error or alert
    await waitFor(() => {
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  it('should submit order with correct data structure', async () => {
    api.post.mockResolvedValue({ data: { _id: 'order123' } });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    // Add item to cart
    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]);

    // Fill delivery address
    const addressInput = screen.getByPlaceholderText('Enter delivery address');
    fireEvent.change(addressInput, { target: { value: '123 Test Street' } });

    // Click checkout
    await waitFor(() => {
      const checkoutButton = screen.getByRole('button', { name: 'Place Order' });
      fireEvent.click(checkoutButton);
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/orders', expect.objectContaining({
        vendor: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            menuItem: 'item1',
            quantity: 1,
            price: 150,
          }),
        ]),
        orderType: 'Retail',
        deliveryMode: 'Delivery',
        deliveryAddress: '123 Test Street',
        customer: expect.objectContaining({
          name: expect.any(String),
        }),
        amount: 150,
        status: 'New',
      }));
    });
  });

  it('should filter menu items by category', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const categorySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(categorySelect, { target: { value: 'Main Course' } });

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
      expect(screen.getByText('Pizza')).toBeInTheDocument();
    });
  });

  it('should filter menu items by food type', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
    });

    const foodTypeSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(foodTypeSelect, { target: { value: 'Veg' } });

    await waitFor(() => {
      expect(screen.queryByText('Burger')).not.toBeInTheDocument();
      expect(screen.getByText('Pizza')).toBeInTheDocument();
    });
  });
});
