import { useState } from 'react';
import Button from './UI/Button';
import Card from './UI/Card';

const Cart = ({ items = [], onUpdateQuantity, onRemoveItem, onCheckout, onClear }) => {
  const calculateTotal = () => {
    return items.reduce((total, item) => {
      const itemPrice = item.variantPrice || item.menuItem?.basePrice || 0;
      return total + (itemPrice * item.quantity);
    }, 0);
  };

  const total = calculateTotal();

  return (
    <Card className="sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Cart</h2>
        {items.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Clear
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8">
          <span className="material-icons-outlined text-4xl text-slate-300 dark:text-slate-700 mb-2">shopping_cart</span>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Your cart is empty</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar mb-4">
            {items.map((item, index) => {
              const itemPrice = item.variantPrice || item.menuItem?.basePrice || 0;
              const itemTotal = itemPrice * item.quantity;

              return (
                <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  {item.menuItem?.image && (
                    <img
                      src={item.menuItem.image}
                      alt={item.menuItem.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {item.menuItem?.name || item.name}
                    </h4>
                    {item.variant && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.variant}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateQuantity && onUpdateQuantity(index, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          disabled={item.quantity <= 1}
                        >
                          <span className="material-icons-outlined text-sm">remove</span>
                        </button>
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity && onUpdateQuantity(index, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <span className="material-icons-outlined text-sm">add</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">₹{itemTotal.toFixed(2)}</span>
                        <button
                          onClick={() => onRemoveItem && onRemoveItem(index)}
                          className="text-red-500 hover:text-red-700"
                          aria-label="Remove item"
                        >
                          <span className="material-icons-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">₹{total.toFixed(2)}</span>
            </div>
            {onCheckout && (
              <Button onClick={onCheckout} className="w-full">
                Checkout
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

export default Cart;
