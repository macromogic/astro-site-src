---
title: "Markdown 语法速查"
date: 2999-12-31
description: "本站 Markdown 支持的扩展语法：脚注、属性块、Pandoc 风格的 fenced div 与 span。仅在开发模式可见。"
draft: true
tags: ["Meta"]
---
这篇草稿只在 `astro dev` 里可见，用来检查渲染效果，也是写作时的语法备忘。除了 CommonMark 和 GFM（表格、删除线、任务列表、脚注[^gfm]），还有下面这些和 Pandoc 对齐的扩展，实现见 `src/lib/remark-attrs.mjs`。

[^gfm]: 脚注用 `[^id]` 引用、`[^id]: 内容` 定义。定义会统一收进文末，位置随意。

<!-- more -->

## 属性块 {#attrs}

标题、图片、链接、行内代码后面紧跟 `{...}` 即可加属性：`#id`、`.class`、`key=value`。`width`/`height` 带单位时转成内联样式。

```markdown
## 标题 {#attrs}
![说明文字](/images/image-20200315231540841.png){width=40%}
[链接](https://docs.astro.build){target=_blank}
`code`{.hl}
```

![说明文字](/images/image-20200315231540841.png){width=40%}

## 行内 span

`[文字]{.class}` 生成 `<span>`，可嵌套，里面可以有加粗、公式：[高亮 **加粗** $x^2$]{.hl}、[次要说明]{.muted}、[小字]{.small}。

## Fenced div

`::: name` 或 `::: {.a .b key=val}` 开始，`:::` 结束，可嵌套（内层用更多冒号区分更清楚）。和 Pandoc 一样，围栏前后最好留空行：紧跟在列表或引用后面的 `:::` 会被 CommonMark 当成上一块的延续行，单独一个结束围栏还能识别出来，开始围栏就不行了。目前有样式的类：

::: {.note title="Fenced div 写法"}
类名是 callout 类型时自动套用提示框样式，`title=` 给标题，不写则没有标题。内容随意：列表、公式、代码块都可以。

- 列表项
- $\gcd(a, b)$
:::

### 提示框（GitHub / Obsidian alert）

短提示更适合用引用块写法，两种写法输出完全一致：

```markdown
> [!tip] 自定义标题（可省略，默认显示类型名）
> 正文，支持 **行内格式** 和公式。

> [!warning]- 折叠的提示框，`-` 默认收起，`+` 默认展开
> 内容
```

> [!tip] 自定义标题
> 正文，支持 **行内格式** 和公式 $e^{i\pi} + 1 = 0$。

> [!warning]- 折叠的提示框
> 点标题展开。

> [!NOTE]
> GitHub 的五种大写写法 NOTE / TIP / IMPORTANT / WARNING / CAUTION 也可以。

支持的类型及 Obsidian 别名：note、info、abstract (summary, tldr)、todo、tip (hint)、important、success (check, done)、question (help, faq)、warning (attention)、caution、danger (error)、failure (fail, missing)、bug、example、quote (cite)。未知类型按默认颜色显示。

::: columns

:::: column
> [!important]
> important
::::

:::: column
> [!question]
> question
::::

:::: column
> [!danger]
> danger
::::

:::: column
> [!example]
> example
::::

:::

### 分栏（beamer 的 columns）

```markdown
::: columns
:::: {.column width=40%}
左栏
::::
:::: column
右栏
::::
:::
```

::: columns
:::: {.column width=40%}
左栏，占 40%。

![](/images/image-20200315231540841.png)
::::
:::: column
右栏，自动占满剩余宽度。窄屏下两栏会上下堆叠。

$$
\int_{-\infty}^{+\infty} e^{-x^2}\,\mathrm{d}x = \sqrt{\pi}
$$
::::
:::

### 其他布局类

`center`、`small`、`large`、`muted`，以及图片浮动 `left`/`right`：

::: center
居中的一段。
:::

![](/images/image-20200315231540841.png){.left width=30%}

图片用 `{.left width=30%}` 向左浮动，正文环绕。任何没定义样式的类名也照常输出到 HTML，在 `global.css` 里加规则即可，不必改插件。

::: {style="clear: both"}
:::
