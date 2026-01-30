import { ClassA } from './moduleA';

export function functionD(): string {
  return 'D';
}

export class ClassD {
  private a: ClassA;

  constructor() {
    this.a = new ClassA();
  }

  methodD(): void {
    this.a.methodA();
    console.log('methodD called');
  }
}