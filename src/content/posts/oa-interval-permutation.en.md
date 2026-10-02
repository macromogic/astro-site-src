---
title: "OA Recap: The Secret Behind Block Reordering"
date: 2026-10-02
tags: ["Interview", "Algorithm", "Math"]
---

> Translated by GPT 5.6 Sol.

## Problem Statement

Suppose a row of robots is divided into three groups and initially arranged as $[A_1, \dots, A_n, B_1, \dots, B_m, C_1, \dots, C_k]$. We need to rearrange them into $[C_1, \dots, C_k, B_1, \dots, B_m, A_1, \dots, A_n]$ while preserving the relative order within each group. We have one cart and a `moveRobot(pos)` interface with the following behavior:

- If the cart is empty, the robot at `pos` is placed on the cart, leaving that position empty.
- If the cart is not empty, there are two cases:
    - If `pos` contains a robot, that robot is moved to the empty position, leaving `pos` empty.
    - If `pos` is empty, the robot on the cart is placed at `pos`.

Given positive integers $n, m, k$, simulate the rearrangement and return the number of calls to `moveRobot`. Fewer calls are better, and a special judge verifies the final arrangement.

<!-- more -->

```c++
unsigned long long robotCount(int n, int m, int k)
{
    // Solution code
}
```

## First Attempt

~~Without the single-cart restriction, one could simply call `memcpy`.~~

Let $N = n + m + k$. The rearrangement is a **permutation** of the integer interval $[0, N)$. Since every permutation decomposes into disjoint cycles[^1], we can complete the rearrangement by traversing those cycles one at a time.

```cpp
unsigned long long robotCount(int n, int m, int k)
{
    auto map2prev = [&](unsigned long long x) {
        if (x < k) {
            return x + n + m;
        } else if (x - k < m) {
            return x - k + n;
        } else {
            return x - k - m;
        }
    };
    
    unsigned long long H = static_cast<unsigned long long>(n) + m;
    bool* moved = new bool[H];
    memset(moved, 0, H * sizeof(bool));
    
    unsigned long long pos = 0;
    unsigned long long count = 0;
    while (pos < H) {
        if (moved[pos]) {
            pos++;
            continue;
        }
        // Find the first robot that has not been moved.
        moveRobot(pos);
        count++;
        // Process the entire cycle.
        auto move_dest = pos;
        auto to_move = map2prev(pos);
        while (to_move != pos) {
            moveRobot(to_move);
            count++;
            if (to_move < H) {
                moved[to_move] = true;
            }
            move_dest = to_move;
            to_move = map2prev(to_move);
        }
        moveRobot(move_dest);
        count++;
        moved[pos] = true;
        pos++;
    }
    
    delete[] moved;
    return count;
}
```

The natural approach above uses a `moved` array to record which positions have already been visited. Because $N$ may exceed the range of `int`, the indices must use `unsigned long long`. At the same time, allocating an array of size $N$ may throw `std::bad_alloc`.

Each selected `pos` represents a permutation cycle that has not yet been processed. This raises a natural question: can we scan only the first $H$ positions, where $H < N$, and still guarantee that we encounter every cycle? Experimentally, $H = n + m$, as used above, passes every test case—but is it optimal?

## Where the Permutation Cycles Live

Intuitively, some $H \leq n + m$ should exist such that every permutation cycle intersects $[0, H)$. We now look for the smallest possible value of $H$.

Following `map2prev`, define a permutation $q(x)$ that maps each destination position $x$ to the position from which its robot must come:

$$
q(x) = \begin{cases}
    x + n + m, & 0 \leq x < k \\
    x - k + n, & k \leq x < k + m \\
    x - k - m, & k + m \leq x < n + m + k
\end{cases}
$$

Subtracting $x$ from both sides gives

$$
q(x) - x = \begin{cases}
    n + m, & 0 \leq x < k \\
    -k + n, & k \leq x < k + m \\
    -(k + m), & k + m \leq x < n + m + k.
\end{cases}
$$

[Notice that]{tip="Nice observation 💀"} $-k + n = (n + m) - (k + m)$. Let $g = \gcd(n + m, k + m)$. It follows that $q(x) - x \equiv 0 \pmod{g}$, or equivalently,

$$
q(x) \equiv x \pmod{g}.
$$

In other words, a cycle never leaves its residue class modulo $g$. In fact, we can prove the stronger statement that every residue class modulo $g$ corresponds to exactly one permutation cycle.

For example, take $n = 2, m = 2, k = 4$. Then $g = \gcd(4, 6) = 2$, and $q$ decomposes into exactly two cycles: one containing the even positions and one containing the odd positions.

![The arrows show the direction in which robots move, opposite to the direction of the mapping $q(\cdot)$. Colors distinguish the two cycles. Traversing either cycle once completes the rearrangement within that cycle.](/images/permutation-n2-m2-k4.svg){.center width=80%}

::: {.tip title="Lemma"}
For a cyclic rotation by $s$ positions of a sequence of length $L$, every permutation cycle is a residue class modulo $d = \gcd(L, s)$.
:::: {.note title="Proof"}
Let $R(x) = (x + s) \bmod L$ denote the rotation. Starting from $x$, after $t$ applications we reach $R^t(x) = (x + ts) \bmod L$. We return to the starting position exactly when $x + ts \equiv x \pmod{L}$, or $ts \equiv 0 \pmod{L}$. Therefore, the cycle length is the smallest positive integer $t$ satisfying $L \mid ts$, namely

$$
t = \frac{L}{\gcd(L, s)} = \frac{L}{d}.
$$

In particular, the cycle length does not depend on $x$.

Since $d \mid s$, we have $R^t(x) \equiv x \pmod{d}$ for every $t$. Thus, the orbit starting at $x$ stays inside the residue class of $x$ modulo $d$. That residue class also contains exactly $L/d$ elements, so it is precisely one permutation cycle.
::::
:::

Now return to the original problem. Construct a new sequence of length $L = N + m = n + 2m + k$:

$$
[A_1, \dots, A_n, B_1, \dots, B_m, C_1, \dots, C_k, B'_1, \dots, B'_m],
$$

where $B'_i$ is a copy of $B_i$. Rotating this sequence to the right by $s = m + k$ positions produces

$$
[C_1, \dots, C_k, B'_1, \dots, B'_m, A_1, \dots, A_n, B_1, \dots, B_m].
$$

The first $n + m + k$ positions after the rotation are exactly the desired rearrangement, with each $B'_i$ standing in for $B_i$. We may therefore identify $B_i$ and $B'_i$. Collapsing these duplicate nodes in the rotation cycles leaves the same cycle partition as $q$—possibly traversed in the opposite direction, which does not change the cycles themselves. By the lemma, every cycle is exactly a residue class modulo

$$
d = \gcd(L, s)
  = \gcd(n + 2m + k, m + k)
  = \gcd(n + m, m + k)
  = g.
$$

We can now conclude that the smallest valid value of $H$ is

$$
H = g = \gcd(n + m, k + m).
$$

The first $g$ positions contain one representative from every cycle, so the `moved` array is no longer necessary and the space complexity drops to $O(1)$. The value is minimal because if $H < g$, then $[0, H)$ contains no position with residue $H$ modulo $g$ and therefore misses the corresponding cycle.

A slightly weaker result is that when $n \neq k$, [we may take $H = \max(n, k)$]{tip="Proof left as an exercise for the reader."}. This version is easier to discover during an online assessment, at the cost of $O(\max(n, k))$ space.

The simulation runs in $O(n + m + k)$ time. When $n = k$, only the $A$ and $C$ blocks need to be exchanged, requiring $3n$ calls. Otherwise, the total number of calls is

$$
n + m + k + \gcd(n + m, m + k).
$$

The final implementation is as follows:

```cpp
unsigned long long robotCount(int n, int m, int k)
{
    auto map2prev = [&](unsigned long long x) {
        if (x < k) {
            return x + n + m;
        } else if (x - k < m) {
            return x - k + n;
        } else {
            return x - k - m;
        }
    };
    
    unsigned long long H = std::gcd(
        static_cast<unsigned long long>(n) + m,
        static_cast<unsigned long long>(k) + m);
    
    unsigned long long count = 0;
    for (unsigned long long pos = 0; pos < H; pos++) {
        auto to_move = map2prev(pos);
        if (to_move == pos) {
            // Special case: the robot is already in the correct position.
            continue;
        }
        moveRobot(pos);
        count++;
        auto move_dest = pos;
        while (to_move != pos) {
            moveRobot(to_move);
            count++;
            move_dest = to_move;
            to_move = map2prev(to_move);
        }
        moveRobot(move_dest);
        count++;
    }
    
    return count;
}
```

## Epilogue

One of the most fascinating aspects of mathematics is how a carefully chosen invariant can decompose a complicated structure into simple, independent pieces. Matrix diagonalization, decompositions of vector spaces, and the use of characteristic equations for homogeneous recurrences all share this theme: identify the structures preserved by a transformation, then study them separately.

In this problem, recognizing the rearrangement as a permutation made its cycles the natural object of study. The repeated addition and subtraction of a few fixed integers suggests divisibility and congruence, which leads to number theory, the greatest common divisor, and residue classes. The proof also illustrates a common lifting technique: embed an awkward problem into a larger, more regular space. What originally looks like a collection of disconnected permutation steps then becomes the projection of a simple rotation. The ability to find such representations is valuable not only in theoretical work, but also when searching for unexpectedly simple systems solutions.

[^1]: https://www.bohrium.com/sciencepedia/feynman/keyword/cycle_permutation
