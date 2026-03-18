"""Fibonacci and prime fixtures for tree-sitter parser tests."""
import math


def fibonacci(n, memo=None):
    """Return the nth Fibonacci number (memoised)."""
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo)
    return memo[n]


def is_prime(n):
    """Return True if n is a prime number."""
    if n < 2:
        return False
    for i in range(2, int(math.sqrt(n)) + 1):
        if n % i == 0:
            return False
    return True


primes_under_50 = [x for x in range(2, 50) if is_prime(x)]

if __name__ == "__main__":
    print([fibonacci(i) for i in range(10)])
    print(primes_under_50)
