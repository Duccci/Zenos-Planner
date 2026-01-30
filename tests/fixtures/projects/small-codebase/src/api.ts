export class API {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://api.example.com') {
    this.baseUrl = baseUrl;
  }

  async get(endpoint: string): Promise<any> {
    // Mock API call
    console.log(`GET ${this.baseUrl}${endpoint}`);
    return { data: 'mock response' };
  }

  async post(endpoint: string, data: any): Promise<any> {
    // Mock API call
    console.log(`POST ${this.baseUrl}${endpoint}`, data);
    return { success: true, id: Math.random().toString(36).substr(2, 9) };
  }
}