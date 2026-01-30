import { functionC } from './moduleC';

export function functionB(): string {
  return 'B' + functionC();
}

export class ClassB {
  constructor() {
    console.log('ClassB created');
  }

  methodB(): void {
    console.log('methodB called');
  }
}