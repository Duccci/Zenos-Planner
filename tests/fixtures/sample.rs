// Fibonacci and prime fixtures for tree-sitter parser tests.

fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn is_prime(n: u64) -> bool {
    if n < 2 {
        return false;
    }
    let limit = (n as f64).sqrt() as u64 + 1;
    for i in 2..limit {
        if n % i == 0 {
            return false;
        }
    }
    true
}

fn main() {
    let fibs: Vec<u64> = (0..10).map(fibonacci).collect();
    println!("{:?}", fibs);

    let primes: Vec<u64> = (2..50).filter(|&x| is_prime(x)).collect();
    println!("{:?}", primes);
}
