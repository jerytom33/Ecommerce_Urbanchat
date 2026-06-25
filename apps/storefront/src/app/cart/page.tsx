import { Button, Card, CardContent } from '@ecommerce/ui';

/**
 * Cart Page - Displays current cart items with quantity controls and checkout CTA.
 * Renders immediately server-side for fast LCP.
 *
 * Requirements: 14.1, 14.3
 */
export default function CartPage() {
  // Placeholder cart data; in production, fetched from Cart Service via Redis
  const cartItems = [
    { id: '1', title: 'Product 1', price: 29.99, quantity: 2, sku: 'PROD-001' },
    { id: '2', title: 'Product 2', price: 49.99, quantity: 1, sku: 'PROD-002' },
  ];

  const subtotal: number = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping: number = 0; // Free shipping placeholder
  const total: number = subtotal + shipping;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-text">Shopping Cart</h1>

      {cartItems.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <Card key={item.id} className="flex gap-4 items-center">
                <CardContent className="flex flex-1 items-center gap-4">
                  {/* Item Image Placeholder */}
                  <div className="w-20 h-20 bg-surface rounded-md flex-shrink-0 flex items-center justify-center border border-border">
                    <span className="text-muted text-xs">Img</span>
                  </div>

                  {/* Item Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text truncate">{item.title}</h3>
                    <p className="text-sm text-muted">SKU: {item.sku}</p>
                    <p className="text-sm font-medium text-primary">${item.price.toFixed(2)}</p>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center gap-2">
                    <button
                      className="w-8 h-8 flex items-center justify-center border border-border rounded-md text-sm hover:bg-surface transition-colors"
                      aria-label={`Decrease quantity of ${item.title}`}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      className="w-8 h-8 flex items-center justify-center border border-border rounded-md text-sm hover:bg-surface transition-colors"
                      aria-label={`Increase quantity of ${item.title}`}
                    >
                      +
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    className="text-muted hover:text-error transition-colors text-sm"
                    aria-label={`Remove ${item.title} from cart`}
                  >
                    ✕
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div>
            <Card>
              <CardContent className="space-y-4">
                <h2 className="text-lg font-bold text-text">Order Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Subtotal</span>
                    <span className="text-text">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Shipping</span>
                    <span className="text-success">{shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-bold">
                    <span className="text-text">Total</span>
                    <span className="text-text">${total.toFixed(2)}</span>
                  </div>
                </div>
                <a href="/checkout">
                  <Button variant="primary" size="lg" className="w-full">
                    Proceed to Checkout
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="text-center py-16">
      <p className="text-lg text-muted mb-4">Your cart is empty</p>
      <a href="/products">
        <Button variant="primary">Continue Shopping</Button>
      </a>
    </div>
  );
}
