export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  static validate(user: Partial<User>): boolean {
    return !!(user.email && user.name);
  }

  static sanitize(user: User): User {
    return {
      ...user,
      email: user.email.toLowerCase().trim(),
      name: user.name.trim()
    };
  }
}