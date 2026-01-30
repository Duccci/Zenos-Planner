import { User } from './user';
import { Product } from './product';

export interface Order {
  id: string;
  userId: string;
  productIds: string[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  createdAt: Date;
}

export class OrderModel {
  static calculateTotal(products: Product[]): number {
    return products.reduce((sum, product) => sum + product.price, 0);
  }

  static validate(order: Partial<Order>): boolean {
    return !!(order.userId && order.productIds && order.productIds.length > 0);
  }
}