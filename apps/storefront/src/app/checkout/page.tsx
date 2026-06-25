import { Button, Card, CardContent, Input } from '@ecommerce/ui';

/**
 * Checkout Page - Multi-step checkout form rendered server-side.
 * In production, this integrates with the Payment Service and Order Service.
 *
 * Requirements: 14.1, 14.3
 */
export default function CheckoutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-text">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Checkout Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-lg font-bold text-text">Contact Information</h2>
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
              />
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-lg font-bold text-text">Shipping Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="First Name" placeholder="John" />
                <Input label="Last Name" placeholder="Doe" />
              </div>
              <Input label="Address" placeholder="123 Main St" />
              <Input label="Apartment, suite, etc." placeholder="Apt 4B" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="City" placeholder="New York" />
                <Input label="State" placeholder="NY" />
                <Input label="ZIP Code" placeholder="10001" />
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-lg font-bold text-text">Payment</h2>
              <p className="text-sm text-muted">
                Payment integration will be handled by the Payment Service (Stripe/Adyen).
                This is a placeholder for the checkout flow.
              </p>
              <Input label="Card Number" placeholder="4242 4242 4242 4242" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Expiry" placeholder="MM/YY" />
                <Input label="CVC" placeholder="123" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="sticky top-24">
            <CardContent className="space-y-4">
              <h2 className="text-lg font-bold text-text">Order Summary</h2>

              {/* Order Items */}
              <div className="space-y-3">
                {[
                  { title: 'Product 1', qty: 2, price: 29.99 },
                  { title: 'Product 2', qty: 1, price: 49.99 },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-text">
                      {item.title} × {item.qty}
                    </span>
                    <span className="text-text">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Subtotal</span>
                  <span className="text-text">$109.97</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Shipping</span>
                  <span className="text-success">Free</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Tax</span>
                  <span className="text-text">$8.80</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span className="text-text">Total</span>
                  <span className="text-text">$118.77</span>
                </div>
              </div>

              <Button variant="primary" size="lg" className="w-full">
                Place Order
              </Button>

              <p className="text-xs text-muted text-center">
                By placing your order, you agree to our Terms of Service and Privacy Policy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
