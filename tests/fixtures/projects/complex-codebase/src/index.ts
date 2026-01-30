import { functionA } from './moduleA';
import { functionB } from './moduleB';
import { functionC } from './moduleC';
import { functionD } from './moduleD';
import { functionE } from './moduleE';

console.log(functionA());
console.log(functionB());
console.log(functionC());
console.log(functionD());
console.log(functionE());

export { functionA, functionB, functionC, functionD, functionE };