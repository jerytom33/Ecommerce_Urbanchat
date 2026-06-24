import { Card, CardHeader, CardContent, Button, Badge } from '@ecommerce/ui';

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <p className="text-muted mt-1">E-commerce Platform Administration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-muted">Total Orders</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text">0</p>
            <Badge variant="success">Active</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-muted">Products</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-muted">Customers</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-muted">Revenue</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text">$0.00</p>
          </CardContent>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader>
          <h2 className="text-lg font-semibold text-text">Quick Actions</h2>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button variant="primary" size="md">Add Product</Button>
            <Button variant="outline" size="md">View Orders</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
