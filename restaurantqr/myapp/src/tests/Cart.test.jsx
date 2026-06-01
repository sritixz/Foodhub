import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Cart from '../components/Cart';

describe('Cart Component', () => {
  const mockItems = [
    {
      menuItem: {
        _id: 'item1',
        name: 'Burger',
        basePrice: 150,
        image: 'https://example.com/burger.jpg',
      },
      quantity: 2,
      variantPrice: 150,
    },
    {
      menuItem: {
        _id: 'item2',
        name: 'Pizza',
        basePrice: 200,
      },
      quantity: 1,
      variantPrice: 200,
    },
  ];

  it('should render empty cart message when no items', () => {
    render(<Cart items={[]} />);
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
  });

  it('should display cart items', () => {
    render(<Cart items={mockItems} />);
    expect(screen.getByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Pizza')).toBeInTheDocument();
  });

  it('should calculate total correctly', () => {
    render(<Cart items={mockItems} />);
    // Total: (150 * 2) + (200 * 1) = 500
    expect(screen.getByText('₹500.00')).toBeInTheDocument();
  });

  it('should call onUpdateQuantity when quantity buttons clicked', () => {
    const handleUpdateQuantity = vi.fn();
    render(<Cart items={mockItems} onUpdateQuantity={handleUpdateQuantity} />);

    // Find increment buttons by their icon text "add"
    const incrementButtons = screen.getAllByText('add');
    fireEvent.click(incrementButtons[0].closest('button'));

    expect(handleUpdateQuantity).toHaveBeenCalledWith(0, 3);
  });

  it('should call onRemoveItem when delete button clicked', () => {
    const handleRemoveItem = vi.fn();
    render(<Cart items={mockItems} onRemoveItem={handleRemoveItem} />);

    const deleteButtons = screen.getAllByLabelText('Remove item');
    fireEvent.click(deleteButtons[0]);

    expect(handleRemoveItem).toHaveBeenCalledWith(0);
  });

  it('should call onCheckout when checkout button clicked', () => {
    const handleCheckout = vi.fn();
    render(<Cart items={mockItems} onCheckout={handleCheckout} />);

    const checkoutButton = screen.getByText('Checkout');
    fireEvent.click(checkoutButton);

    expect(handleCheckout).toHaveBeenCalled();
  });

  it('should call onClear when clear button clicked', () => {
    const handleClear = vi.fn();
    render(<Cart items={mockItems} onClear={handleClear} />);

    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    expect(handleClear).toHaveBeenCalled();
  });

  it('should disable decrement button when quantity is 1', () => {
    const singleItem = [{
      menuItem: { _id: 'item1', name: 'Burger', basePrice: 150 },
      quantity: 1,
      variantPrice: 150,
    }];

    render(<Cart items={singleItem} />);

    // Find decrement button by its icon text "remove"
    const decrementButton = screen.getByText('remove').closest('button');
    expect(decrementButton).toBeDisabled();
  });
});
