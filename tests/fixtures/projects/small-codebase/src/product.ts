export class Product {
  constructor(
    public id: string,
    public name: string,
    public price: number
  ) {}

  getFormattedPrice(): string {
    return `$${this.price.toFixed(2)}`;
  }
}