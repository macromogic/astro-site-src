---
title: "校招OA复盘：区间重排的秘密"
date: 2026-10-02
tags: ["Interview", "Algorithm", "Math"]
---
最近刚完成某N厂的OA题目，难度比想象中高了很多，不过里面的问题非常有意思。正好趁求职这段时间复盘一下题目，顺带挖掘一下隐含的一些问题。

## 题目背景

有一排机器人分三组，按$[A_1, \dots, A_n, B_1, \dots, B_m, C_1, \dots, C_k]$排列，现在需要重排成$[C_1, \dots, C_k, B_1, \dots, B_m, A_1, \dots, A_n]$，其中每一组内相对位置不变。现有一个cart和一个`moveRobot(pos)`接口用来移动机器人，规则如下：
- 若cart为空，将`pos`上的机器人放进cart，该位置变成空位；
- 若cart非空，考虑两种情况：
    - 如果`pos`有机器人，将其移动到空位上，该位置变成空位；
    - 如果`pos`是空位，把cart上的机器人移动到`pos`上。

要求：给定$n, m, k$，其中$n, m, k$都是正整数，模拟重排过程并返回调用`moveRobot`的次数，越少越好。SPJ会检查重排后的结果。

<!-- more -->

``` c++
unsigned long long robotCount(int n, int m, int k)
{
    // Solution code
}
```

## 初步思路

~~如果没有仅一个cart这个限制，调`memcpy`就够了。~~

令$N = n + m + k$，观察到这个重排可以理解成对$[0, N)$这个整数区间做一次**置换**（permutation）。由于任何置换都可以分解为若干个不相交的循环（cycle）[^1]，我们可以利用这个性质，遍历所有循环完成重排。


``` cpp
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
        // 找到当前第一个没被移动的机器人
        moveRobot(pos);
        count++;
        // 处理整个循环
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

如上所示，我们很自然地可以想到用一个`moved`数组来记录哪些位置的机器人已经被移动过。由于$N$会超过int的表示范围，下标需要使用`unsigned long long`类型；同时申请大小为$N$的数组会导致`std::bad_alloc`异常。

不难发现，每次找到的`pos`都代表一个置换循环的起点，我们自然会问：能不能仅扫描前$H$个位置（$H < N$）从而保证所有置换循环都能被遍历到？经验证，$H = n + m$（见上述代码）能通过所有测试点，不过这会是最优解吗？

## 置换循环的分布

直觉上，一定存在某个$H$满足$H \leq n + m$使得所有置换循环都和$[0, H)$区间相交。我们接下来探究这个$H$的最小值。

沿用`map2prev`函数定义置换$q(x)$表示位置$x$对应的机器人应该从哪里来，即目标位置到来源位置的映射：
$$
q(x) = \begin{cases}
    x + n + m, & 0 \leq x < k \\
    x - k + n, & k \leq x < k + m \\
    x - k - m, & k + m \leq x < n + m + k
\end{cases}
$$
等式两边同时减去$x$得到：
$$
q(x) - x = \begin{cases}
    n + m, & 0 \leq x < k \\
    -k + n, & k \leq x < k + m \\
    -(k + m), & k + m \leq x < n + m + k
\end{cases}
$$
[观察到]{tip="超绝注意力！"}$-k + n = (n + m) - (k + m)$，令$g = \gcd(n + m, k + m)$，不难得出$q(x) - x \equiv 0 \pmod{g}$，即$q(x) \equiv x \pmod{g}$。也就是说，一个循环不会离开自己的模$g$剩余类。我们甚至可以证明，每个模$g$剩余类恰好代表一个置换循环。

例如，取$n = 2, m = 2, k = 4$，则$g = \gcd(4, 6) = 2$。置换$q$恰好分成两个循环，分别由偶数位置和奇数位置组成：

![箭头表示交换的方向（和$q(\cdot)$的映射方向相反），颜色代表不同循环。沿任一循环走一周，就能完成该循环内的重排。](/images/permutation-n2-m2-k4.svg){.center width=80%}

::: {.tip title="引理"}
对一个长度为$L$的序列做步长为$s$的循环移位（rotation），得到的每个置换循环是模$d = \gcd(L, s)$的剩余类。
:::: {.note title="证明"}
令$R(x) = (x + s) \bmod L$表示该循环移位，对每个起始位置$x$，移位$t$次后的位置为$R^t(x) = (x + ts) \bmod L$。因此，移动回原来位置的充要条件是$x + ts \equiv x \pmod{L}$，即$ts \equiv 0 \pmod{L}$。因此，置换循环的长度是满足$L | ts$的最小正整数$t$，自然就有$t = L / \gcd(L, s) = L / d$，即置换循环长度和$x$无关。

由于$d | s$，不难证明$R^t(x) \equiv x \pmod{d}$，因此从$x$出发的移位轨迹一定在和$x$同余的模$d$剩余类中。又因为剩余类的大小也是$L / d$，所以每个模$d$剩余类恰好代表一个置换循环。
::::
:::

现在我们回到原题。我们构造一个长度为$L = N + m = n + 2m + k$的新序列
$$
[A_1, \dots, A_n, B_1, \dots, B_m, C_1, \dots, C_k, B'_1, \dots, B'_m]，
$$
其中$B'_i$表示$B_i$处机器人的副本。将该序列向右循环移动$s = m + k$个位置，得到的结果为
$$
[C_1, \dots, C_k, B'_1, \dots, B'_m, A_1, \dots, A_n, B_1, \dots, B_m]。
$$
不难发现，循环移动后的前$n + m + k$个位置即为原题中的区间重排，循环移位后的$B'_i$恰好可以替代$B_i$，因而可以把旋转前后的$B_i$和$B'_i$视作等价的。旋转循环中$B'_i$与$B_i$之间的重复节点被合并，剩余轨迹恰好对应$q$的循环。由上述引理可以直接得到，每个置换循环正好就是模$d = \gcd(L, s) = \gcd(n + 2m + k, m + k) = \gcd(n + m, m + k) = g$的剩余类。

至此，我们得出结论：$H$最小取$g = \gcd(n + m, k + m)$，上述算法依然有效；甚至由于前$g$个位置恰好对应所有循环，我们可以去掉`moved`数组，把空间复杂度压缩到$O(1)$。若$H < g$，则$[0, H)$区间没有模$g$余$H$对应的循环，答案会出错。一个稍弱的结论是，在$n \neq k$时，[可以令$H = \max(n, k)$]{tip="证明留给读者思考"}。这版思路在OA中相对容易想到，代价是$O(\max(n, k))$的空间复杂度。模拟过程总时间复杂度$O(n + m + k)$：当$n = k$时，只需交换$A$和$C$部分，调用次数只需$3n$；否则调用总次数为$n + m + k + \gcd(n + m, m + k)$。最终代码如下：

``` cpp
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
            // 特殊情况：当前位置的机器人不需要移动
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

## 后记

数学问题最引人入胜的一个点在于，它们往往隐藏着一些巧妙的不变量，可以以“四两拨千斤”的方式把一个复杂的结构拆解成简单的组件。从矩阵对角化到线性空间分解，从齐次递推到特征方程，其核心都是找到并分析这些“正交”的不变性。在这道题中，我们首先注意到了置换变换和循环，循环的性质自然成为了分析问题的关键。变换过程中反复的加减特定的整数，能引导我们联想整除或同余，进而引入数论和$\gcd$，在这个有限环上探究和剩余类的关系。此外，很多巧妙的证明其实蕴含了数学家常用的lifting的思想，即把当前问题放在一个“更高维度”的空间中；此时一些原来看似离散的点便成了某个连续轨迹在一个截面上的交点，一个棘手的permutation瞬间变成了一个很简洁漂亮的rotation。在理论研究和系统设计中，想要提出一些巧妙的trick来达成奇效，这些思想功不可没。

[^1]: https://www.bohrium.com/sciencepedia/feynman/keyword/cycle_permutation
