import { User, UserModel } from '../models/user';
import { Database } from '../utils/database';

export class UserService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    if (!UserModel.validate(userData)) {
      throw new Error('Invalid user data');
    }

    const user: User = {
      ...userData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return UserModel.sanitize(user);
  }

  async getUserById(id: string): Promise<User | null> {
    // Mock database call
    return null;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}