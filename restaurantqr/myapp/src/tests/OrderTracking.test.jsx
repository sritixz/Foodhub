import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrderTracking from '../pages/OrderTracking';
import api from '../utils/api';

vi.mock('../utils/api');
vi.mock('../components/Layout/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>
}));
vi.mock('../components/Layout/Header', () => ({
  default: ({ title }) => (
    <div data-testid="header">
      <span>{title}</span>
    </div>
  )
}));

describe('OrderTracking Component', () => {
  const mockOrder = {
    _id: 'order123',
    orderId: 'ORD-20240001',
    status: 'New',
    items: [
      {
        menuItem: {
          _id: 'item1',
          name: 'Burger',
          image: 'https://example.com/burger.jpg',
          basePrice: 150,
        },
        quantity: 2,
        price: 150,
      },
    ],
    vendor: {
      _id: 'vendor1',
      name: 'Test Restaurant',
    },
    deliveryAddress: '123 Test Street',
    notes: 'Ring the bell',
    orderType: 'Retail',
    amount: 300,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: mockOrder });
    
    // Mock EventSource
    global.EventSource = vi.fn(() => ({
      onmessage: null,
      onerror: null,
      close: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (orderId = 'order123') => {
    return render(
      <MemoryRouter initialEntries={[`/orders/track/${orderId}`]}>
        <Routes>
          <Route path="/orders/track/:id" element={<OrderTracking />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('should render order tracking page', async () => {
    renderComponent();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/orders/order123');
    });

    await waitFor(() => {
      expect(screen.getByText('Order ORD-20240001')).toBeInTheDocument();
    });
  });

  it('should display order status', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  it('should display order items', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeInTheDocument();
      expect(screen.getByText('Qty: 2')).toBeInTheDocument();
    });
  });

  it('should display delivery information', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('123 Test Street')).toBeInTheDocument();
      expect(screen.getByText('Ring the bell')).toBeInTheDocument();
    });
  });

  it('should calculate and display total amount', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('₹300.00').length).toBeGreaterThan(0);
    });
  });

  it('should display loading state initially', () => {
    api.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderComponent();

    expect(screen.getByText('Loading order...')).toBeInTheDocument();
  });

  it('should display error message when order not found', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(/Order Not Found/i).length).toBeGreaterThan(0);
    });
  });

  it('should establish SSE connection', async () => {
    renderComponent();

    await waitFor(() => {
      expect(global.EventSource).toHaveBeenCalled();
    });
  });

  it('should update order status via SSE', async () => {
    const mockEventSource = {
      onmessage: null,
      onerror: null,
      close: vi.fn(),
    };

    global.EventSource = vi.fn(() => mockEventSource);

    renderComponent();

    await waitFor(() => {
      expect(global.EventSource).toHaveBeenCalled();
    });

    // Simulate SSE message
    const updatedOrder = { ...mockOrder, status: 'Preparing' };
    await act(async () => {
      mockEventSource.onmessage({
        data: JSON.stringify({
          type: 'order_update',
          order: updatedOrder,
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Preparing').length).toBeGreaterThan(0);
    });
  });

  it('should display correct status steps', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Order Placed')).toBeInTheDocument();
      expect(screen.getByText('Preparing')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });
});
