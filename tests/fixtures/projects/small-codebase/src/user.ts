export class User {
  constructor(
    public id: string,
    public name: string,
    public email: string
  ) {}

  toString(): string {
    return `${this.name} (${this.email})`;
  }
}