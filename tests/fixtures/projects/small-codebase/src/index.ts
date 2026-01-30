import { User } from './user';
import { Product } from './product';
import { Order } from './order';
import { API } from './api';

export class App {
  private users: User[] = [];
  private products: Product[] = [];
  private orders: Order[] = [];

  constructor(private api: API) {}

  async initialize(): Promise<void> {
    // Initialize the application
    console.log('App initialized');
  }

  addUser(user: User): void {
    this.users.push(user);
  }

  addProduct(product: Product): void {
    this.products.push(product);
  }

  createOrder(userId: string, productIds: string[]): Order {
    const user = this.users.find(u => u.id === userId);
    const products = this.products.filter(p => productIds.includes(p.id));

    if (!user || products.length === 0) {
      throw new Error('Invalid user or products');
    }

    const order = new Order(user, products);
    this.orders.push(order);
    return order;
  }
}