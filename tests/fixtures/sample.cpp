// Fibonacci and prime fixtures for tree-sitter parser tests.
#include <cmath>
#include <iostream>
#include <vector>

long long fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

bool isPrime(int n) {
    if (n < 2) return false;
    int limit = static_cast<int>(std::sqrt(static_cast<double>(n))) + 1;
    for (int i = 2; i < limit; ++i) {
        if (n % i == 0) return false;
    }
    return true;
}

int main() {
    for (int i = 0; i < 10; ++i) {
        std::cout << "fib(" << i << ") = " << fibonacci(i) << "\n";
    }
    std::vector<int> primes;
    for (int x = 2; x < 50; ++x) {
        if (isPrime(x)) primes.push_back(x);
    }
    for (int p : primes) {
        std::cout << p << " is prime\n";
    }
    return 0;
}
