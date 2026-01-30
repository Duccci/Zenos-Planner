import { functionA } from './moduleA';

export function functionC(): string {
  // Careful with circular deps - this might cause issues at runtime
  // but for analysis, it shows the dependency
  return 'C';
}

export class ClassC {
  constructor() {
    console.log('ClassC created');
  }

  methodC(): void {
    console.log('methodC called');
  }
}