import { User } from './user';
import { Product } from './product';

export class Order {
  public id: string;
  public total: number;

  constructor(
    public user: User,
    public products: Product[]
  ) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.total = this.products.reduce((sum, p) => sum + p.price, 0);
  }

  getSummary(): string {
    return `Order ${this.id} by ${this.user.name}: $${this.total.toFixed(2)}`;
  }
}