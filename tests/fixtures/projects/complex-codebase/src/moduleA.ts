import { functionB } from './moduleB';

export function functionA(): string {
  return 'A' + functionB();
}

export class ClassA {
  constructor() {
    console.log('ClassA created');
  }

  methodA(): void {
    console.log('methodA called');
  }
}