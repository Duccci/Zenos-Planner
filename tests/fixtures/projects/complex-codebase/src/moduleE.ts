import { ClassD } from './moduleD';

export function functionE(): string {
  return 'E';
}

export class ClassE {
  private d: ClassD;

  constructor() {
    this.d = new ClassD();
  }

  methodE(): void {
    this.d.methodD();
    console.log('methodE called');
  }
}