# K17 CTF - monoid

## Challenge Description

> There's this really cool fractal I like, but someone encrypted its parameters, even worse they wrote it in haskell, find the parameters to get the flag; glhf

The challenge provided three files:

```text
Main.dump-simpl
Main.dump-asm
out.txt
```

[Main.dump-simpl](https://github.com/v4rr10r/v4rr10r.github.io/blob/main/content/writeups/K17-CTF-2026-monoid/Main.dump-simpl)

At first, the files look intimidating because the main source code is not directly provided. Instead, we are given compiler-generated output from a Haskell program.

The important part of this challenge is realizing that **we do not need to understand everything**.

The goal is to identify which file contains the highest-level useful information, extract the interesting functions, reconstruct what the original program was doing, and then reproduce it ourselves.

---

# 1. Looking at the Three Files

We were given:

```text
Main.dump-simpl
Main.dump-asm
out.txt
```

The challenge description tells us that encrypted parameters are used to generate a fractal.

So naturally, the three files probably represent different stages of the program:

The first important decision was:

> **Focus on `Main.dump-simpl` first.**

---

# 2. Why Focus on `Main.dump-simpl`?

Opening the beginning of the dump immediately tells us something important:

```text
Compiling Decode ( Decode.hs, Decode.o )

Tidy Core
```

This means the file is **GHC Core output**.

GHC is the Glasgow Haskell Compiler, and Core is an intermediate representation used by the compiler.

In other words, instead of getting something nice like:

```haskell
decipher ciphertext key = ...
```

we get compiler-generated expressions such as:

```text
case ...
let ...
GHC.Internal.Types.I#
GHC.Internal.Classes.$fNumInt
```

This looks horrible, but Core has an advantage:

> It is still much closer to the original Haskell logic than assembly is.

The dump also contains:

```text
[2 of 4] Compiling Fractal
...
[3 of 4] Compiling Main
```

So we can see that the compiler output contains the important modules of the program.

The `Fractal` section contains the fractal renderer, while `Main` tells us how everything is connected.

The provided Core contains a palette:

```text
palette_r1Dz = GHC.Internal.CString.unpackCString# " .-:=+*#%@"
```

which is a strong indication that the program is producing ASCII-art rather than a normal graphical image.

---

# 3. Why Not Start With `Main.dump-asm`?

`Main.dump-asm` is assembly.

Assembly is useful when:

- the higher-level representation is unavailable
- the compiler optimized away important information
- we need to analyze machine-level behavior
- we are reversing a native binary

But here we already have something much better:

```text
Haskell source
      ↓
GHC
      ↓
Core
      ↓
Assembly
```

So if Core is available, there is little reason to start with assembly.

The general rule is:

> **Always start with the highest-level representation available.**

For this challenge:

```text
Main.dump-simpl   ← START HERE
Main.dump-asm     ← only if necessary
out.txt       ← inspect after understanding the generator
```

---

# 4. The Biggest Mistake: Reading 600+ Lines From Top to Bottom

A large compiler dump is not something we should read line-by-line from beginning to end.

That is extremely inefficient.

Instead, we search for **anchors**.

For example:

```bash
grep -nE 'main|xor|key|decode|decipher|hex|writeFile|render|palette' Main.dump-simpl
```

Or simply:

```bash
grep -nE 'main|xor|decipher|fromHex|renderJulia' Main.dump-simpl
```

The idea is not to understand the entire file.

We are looking for words that are likely to lead us toward:

- encryption
- decryption
- hardcoded data
- keys
- input
- output
- the program entry point

This quickly points us toward functions such as:

```text
xorChar
unsubsChar
decipher
fromHex
renderJulia
main
```

The original analysis process can therefore be summarized as:

```text
600+ lines
    ↓
Search for interesting names
    ↓
Find crypto functions
    ↓
Find main
    ↓
Find hardcoded ciphertext + key
    ↓
Reconstruct algorithm
```

This is much faster than trying to understand every compiler-generated line.

---

# 5. Understanding GHC Core

Before looking at the actual encryption, we need to know how to mentally simplify Core.

For example, Core might contain:

```text
GHC.Internal.Types.I# 67#
```

We don't need to care about all the compiler internals.

This is basically:

```text
67
```

Similarly:

```text
GHC.Internal.CString.unpackCString# "hello"
```

is basically:

```haskell
"hello"
```

And:

```text
case expression of
```

can usually be mentally read as:

```haskell
case expression of
```

The most useful Core patterns for this challenge were:

### `x : xs`

A list whose first element is `x` and whose remaining elements are `xs`.

For example:

```haskell
a : rest
```

means:

```text
first element = a
remaining list = rest
```

### `(a,b)`

A tuple/pair.

### `map f xs`

Apply `f` to every element of `xs`.

### `zipWith f xs ys`

Take corresponding elements from two lists and apply `f`.

For example:

```haskell
zipWith (+) [1,2,3] [4,5,6]
```

produces:

```text
[5,7,9]
```

### `cycle key`

Repeat the key forever.

For example:

```text
abc
```

becomes conceptually:

```text
abcabcabcabcabc...
```

These few patterns are enough to understand most of the interesting part of this challenge.

---

# 6. Finding `xorChar`

The first important function is:

```haskell
xorChar :: Char -> Char -> Char
```

Its logic simplifies to:

```haskell
xorChar a b = chr (ord a `xor` ord b)
```

In normal language:

1. Convert character `a` to its numeric value.
2. Convert character `b` to its numeric value.
3. XOR the two numbers.
4. Convert the result back into a character.

So:

```text
character
    ↓
ord()
    ↓
integer
    ↓
XOR
    ↓
chr()
    ↓
character
```

This tells us that XOR is one part of the cipher.

---

Yep — the **overview is the sweet spot**. You want enough detail to understand _how we got there_, but not every compiler-generated token.

For **Steps 7 and 8**, I'd write them like this in the writeup:

# 7. Understanding `unsubsChar`

After finding `unsubsChar`, instead of trying to understand all the GHC-generated code, I focused on the meaningful operations inside it.

The Core contains:

```text
unsubsChar_r5 :: Char -> Char

unsubsChar_r5
  = \ (a_aPn :: Char) ->
      ...
      chr
        (mod
           ...
           (- ...
              (ord a_aPn)
              (GHC.Internal.Types.I# 67#))
           (GHC.Internal.Types.I# 128#))
```

The compiler-generated parts can be ignored. The important pieces are:

```text
ord a
  ↓
- 67
  ↓
mod 128
  ↓
chr
```

So I reconstructed the function as:

```haskell
unsubsChar a = chr ((ord a - 67) `mod` 128)
```

The important discovery here is that **the cipher has another transformation after XOR**. It is not just XOR.

The `67` and `128` are directly visible in the Core: `67#` is the constant being subtracted and `128#` is the modulo value.

---

# 8. Understanding `decipher`

Next I looked at how `unsubsChar` is actually used.

The Core contains:

```text
decipher :: String -> String -> String

decipher
  = \ (ct_aza :: String) (key_azb :: String) ->
      ...
      zipWith
        (\ (c_azd :: Char) (k_aze :: Char) ->
           unsubsChar_r5
             (xorChar k_aze c_azd))
        ct_aza
        (cycle key_azb)
```

The important part is:

```text
zipWith
    (\c k -> unsubsChar (xorChar k c))
    ct
    (cycle key)
```

I can read this from the inside out:

```text
xorChar k c
```

means the ciphertext character and key character are XORed first.

Then:

```text
unsubsChar (...)
```

takes that XOR result and performs the operation we discovered in Step 7:

```text
subtract 67
mod 128
```

Finally:

```text
cycle key
```

shows that the key is repeated across the ciphertext.

So the actual flow is:

```text
ciphertext character
        +
repeating key character
        ↓
       XOR
        ↓
    unsubsChar
        ↓
   subtract 67
        ↓
     mod 128
        ↓
    plaintext
```

The Core explicitly shows `xorChar k c` being passed into `unsubsChar`, while `cycle key` supplies the repeating key.

So from the huge Core dump, we have now recovered the important part of the algorithm:

```text
From Hex
    ↓
XOR with repeating "#!s3kur1ty"
    ↓
subtract 67
    ↓
mod 128
    ↓
plaintext
```

**This is the level of detail I'd recommend for the final writeup:** show the actual Core, highlight the 2–3 meaningful pieces, then demonstrate how those pieces become normal Haskell/pseudocode.

---

# 9. The Key

Now we look at `main`.

This is where the interesting hardcoded values are used.

The key is:

```text
#!s3kur1ty
```

The ciphertext is a hexadecimal string.

The program essentially performs:

```haskell
decipher
    (fromHex "...")
    "#!s3kur1ty"
```

The Core therefore gives us everything we need:

```text
ciphertext = hexadecimal data
key        = #!s3kur1ty
```

At this point we no longer need to understand the compiler-generated noise.

We have reconstructed the actual algorithm.

---

# 10. Understanding `fromHex`

Before `decipher` can operate on the ciphertext, the program calls:

```haskell
fromHex
```

The purpose is simply to convert:

```text
hexadecimal text
```

into:

```text
characters/bytes
```

The function first checks whether the input has an even number of characters.

Conceptually:

```haskell
if odd (length input)
    then error "thats not how to fill a burito !"
    else ...
```

Then it splits the hexadecimal input into pairs.

For example:

```text
414243
```

becomes:

```text
41 42 43
```

The Core contains a helper:

```text
pairs_a1l6 :: [Char] -> [(Char, Char)]
```

and the important part simplifies to:

```haskell
pairs [] = []

pairs (a:b:rest) =
    (a,b) : pairs rest
```

So `fromHex` is just preparing the encrypted data for the cipher.

---

# 11. Reconstructing the Complete Cipher

At this point we can write the entire operation in simple pseudocode:

```text
1. Take hexadecimal ciphertext.
2. Convert hex to bytes.
3. Repeat "#!s3kur1ty" over the ciphertext.
4. XOR every ciphertext byte with the corresponding key byte.
5. Subtract 67.
6. Apply modulo 128.
7. Convert the resulting numbers to characters.
```

Or:

```text
HEX
 ↓
bytes
 ↓
XOR with "#!s3kur1ty"
 ↓
SUB 67
 ↓
MOD 128
 ↓
plaintext
```

This is the key breakthrough in the challenge.

---

# 12. The Five Parameters

After decrypting the data, we get:

```text
K17{a_M0NaD_1s_4_M0n0Id_1n_th3_c4t3gORy_0f_3Nd0FuNC70r5}
-0.745643887
0.113825904
180
96
32
```

The five numbers are:

```text
-0.745643887
 0.113825904
 180
 96
 32
```

These correspond to:

```text
real part      = -0.745643887
imaginary part =  0.113825904
max iterations = 180
width          = 96
height         = 32
```

The challenge's `Fractal` module contains:

```text
renderJulia
```

and the Core shows that the program generates the ASCII fractal using the palette:

```text
" .-:=+*#%@"
```

The five decrypted values are therefore exactly what the renderer needs.

---

# 13. Why `out.txt` Matters

The third file is:

```text
out.txt
```

This is the generated ASCII output.

It is useful because it represents the final stage of the program.

The challenge's intended flow is essentially:

```text
encrypted parameters
        ↓
decrypt
        ↓
Julia parameters
        ↓
render Julia fractal
        ↓
ASCII output
        ↓
flag
```

The analysis of the supplied materials confirms that the recovered parameters were fed into `renderJulia` to produce the fractal output.

The confirmed flag is:

```text
K17{a_M0NaD_1s_4_M0n0Id_1n_th3_c4t3gORy_0f_3Nd0FuNC70r5}
```

---

# 14. Even Simpler Version

Once the algorithm is understood, we can make the solver shorter:

```python
hexstr = "2d55090d4f576242655d24030705490250210748502d54111f4450065f0f010704041d5f6024485b500851457a5201384c68255b000613351141070859560b4a1c03094a0e1a505007471d0e0749080a5442074818160e48170f56"

key = "#!s3kur1ty"

data = bytes.fromhex(hexstr)

out = ""

for i, c in enumerate(data):
    k = ord(key[i % len(key)])
    out += chr((c ^ k - 67) % 128)

print(out)
```

For readability, however, I prefer the first version because the parentheses make the order of operations obvious:

```python
x = c ^ ord(k)
x = (x - 67) % 128
```

That mirrors the Haskell much better.

---

# 15. Final Solve Chain

The complete solve can now be summarized as:

```text
Provided files:

Main.dump-simpl
Main.dump-asm
out.txt
        |
        v
Identify Main.dump-simpl as GHC Tidy Core
        |
        v
Don't read all 600+ lines
        |
        v
grep for useful anchors
        |
        v
Find:
    xorChar
    unsubsChar
    decipher
    fromHex
    main
        |
        v
Recover key:
    #!s3kur1ty
        |
        v
Recover ciphertext
        |
        v
fromHex
        |
        v
XOR with repeating key
        |
        v
subtract 67
        |
        v
mod 128
        |
        v
Recover:
    K17{...}
    -0.745643887
     0.113825904
     180
     96
     32
        |
        v
Parameters are passed to renderJulia
        |
        v
ASCII Julia fractal
        |
        v
FLAG
```

---

# Flag

```text
K17{a_M0NaD_1s_4_M0n0Id_1n_th3_c4t3gORy_0f_3Nd0FuNC70r5}
```

---

PWN by **W4RR1OR**
