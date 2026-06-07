import Button from './UI/Button';

const StarDisplay = ({ rating, count }) => {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={`text-sm ${s <= full ? 'text-yellow-400' : s === full + 1 && half ? 'text-yellow-300' : 'text-slate-300'}`}>★</span>
        ))}
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {rating.toFixed(1)}{count ? ` (${count})` : ''}
      </span>
    </div>
  );
};

const MenuItemCard = ({ item, onAddToCart, showAddButton = true }) => {
  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart(item);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-icons-outlined text-6xl text-slate-300 dark:text-slate-700">image</span>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-1 text-xs font-bold rounded ${
            item.foodType === 'Veg' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {item.foodType}
          </span>
        </div>
        {item.status !== 'Available' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold">{item.status}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-slate-900 dark:text-white">{item.name}</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">{item.category?.name || item.category}</span>
        </div>
        {item.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">₹{item.basePrice || '0.00'}</span>
          {showAddButton && item.status === 'Available' && (
            <Button onClick={handleAddToCart} size="sm">
              Add
            </Button>
          )}
        </div>
        {item.averageRating > 0 && (
          <div className="mt-2">
            <StarDisplay rating={item.averageRating} count={item.ratingCount} />
          </div>
        )}
        {item.variants && item.variants.length > 0 && (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {item.variants.length} variant{item.variants.length > 1 ? 's' : ''} available
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuItemCard;
