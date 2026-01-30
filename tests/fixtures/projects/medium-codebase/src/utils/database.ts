export class Database {
  private connected: boolean = false;

  async connect(): Promise<void> {
    // Mock connection
    this.connected = true;
    console.log('Database connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('Database disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    // Mock query
    return [];
  }
}

export async function connectDatabase(): Promise<Database> {
  const db = new Database();
  await db.connect();
  return db;
}