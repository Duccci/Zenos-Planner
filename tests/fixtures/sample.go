// Fibonacci and prime fixtures for tree-sitter parser tests.
package main

import (
	"fmt"
	"math"
)

func fibonacci(n int) int {
	if n <= 1 {
		return n
	}
	return fibonacci(n-1) + fibonacci(n-2)
}

func isPrime(n int) bool {
	if n < 2 {
		return false
	}
	limit := int(math.Sqrt(float64(n))) + 1
	for i := 2; i < limit; i++ {
		if n%i == 0 {
			return false
		}
	}
	return true
}

func main() {
	for i := 0; i < 10; i++ {
		fmt.Printf("fib(%d) = %d\n", i, fibonacci(i))
	}
	for x := 2; x < 50; x++ {
		if isPrime(x) {
			fmt.Printf("%d is prime\n", x)
		}
	}
}
