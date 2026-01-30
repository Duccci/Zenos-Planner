export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  createdAt: Date;
}

export class ProductModel {
  static validate(product: Partial<Product>): boolean {
    return !!(product.name && product.price >= 0);
  }

  static calculateDiscount(product: Product, discountPercent: number): number {
    return product.price * (1 - discountPercent / 100);
  }
}