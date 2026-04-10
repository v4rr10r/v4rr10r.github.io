---
title: ZipCrypto-Plaintext-Attack
date: 2026-04-010
tags:
  - ZipCrypto
  - Known-Plaintext-Attack
  - Cryptanalysis
summary: Demonstrated a known-plaintext attack on ZipCrypto using bkcrack to recover internal cipher keys, decrypt protected files, and bypass the password entirely.
---

# Why Your Password-Protected ZIP File Is Not Actually Safe , ZipCrypto Plaintext Attack Explained

---

## Introduction

ZIP files are one of the most commonly used archive formats, and password-protecting them is something people do every day  to send sensitive documents, share files securely, or just keep things locked away. But not all ZIP encryption is created equal.

There are two main encryption schemes you'll encounter in ZIP archives:

- **ZipCrypto** — the old, legacy method. It's been part of the ZIP spec since the early days and is still the default in many tools.
- **AES-256** — the modern, cryptographically strong alternative.

The difference between them is enormous. In this writeup, I'm going to walk you through **why ZipCrypto is fundamentally broken**, how the **known-plaintext attack** works, and demonstrate it practically on a lab I set up myself. A ZIP archive containing two files: `hosts.txt` and `secret.txt`.

The goal? Read the contents of `secret.txt`  without ever knowing the password.

---

## What is ZipCrypto and Why Is It Weak?

### The ZipCrypto Encryption Header

When you encrypt a file using ZipCrypto, the ZIP format prepends a **12-byte encryption header** to each encrypted file entry before the actual (compressed or uncompressed) data begins.

Here's what that looks like conceptually:

```
[12-byte ZipCrypto encryption header] [actual file data (encrypted)]
```

The 12-byte header serves a dual purpose:
1. It initializes the cipher's internal state.
2. The last byte of the header is used to verify the password during decryption.

You can observe this directly from archive metadata. If a file is stored uncompressed (method: `Store`) and the encrypted size is **N bytes more than the uncompressed size**, those extra bytes are the encryption header:

```
encrypted size - uncompressed size = 12 bytes overhead
```

This is consistent and predictable  and that predictability is part of what makes ZipCrypto attackable.

### The Three Internal Keys

ZipCrypto doesn't work like a simple "password → decrypt" function. Internally, it maintains **three 32-bit state values** (keys), typically labeled `K0`, `K1`, and `K2`. The password is used to initialize these three keys, and then the cipher continuously updates them as it processes each byte.

The actual byte-level encryption is done by XOR:

```
ciphertext_byte = plaintext_byte XOR keystream_byte
```

Where `keystream_byte` is derived from the current internal key state.

### XOR and Why It Makes This Attackable

XOR has a beautiful mathematical property:

```
A XOR B = C
C XOR B = A   ← reversible
C XOR A = B   ← also reversible
```

This means: **if you know the plaintext and the ciphertext, you can recover the keystream.** And if you can recover enough keystream bytes, you can reconstruct the internal cipher state — the three keys  without ever needing the original password.

That's the core idea behind the **known-plaintext attack**.

You need at least **8 bytes** of known plaintext (the actual unencrypted content of the file at a known offset) for the attack to begin. In practice, 12+ bytes makes it much faster and more reliable.

For ZipCrypto Store (uncompressed) this is straightforward  you know the raw file bytes directly. For ZipCrypto **Deflate** (compressed), it's significantly harder. DEFLATE doesn't just compress your data  it wraps it in blocks, and each block has a header. When DEFLATE gives up on compressing a chunk (which happens often with already-compressed formats like PNG, since there's nothing left to squeeze), it falls back to a **stored block** (BTYPE=00 in RFC 1951). A stored block doesn't compress the data at all, but it still prepends a **5-byte header** before the raw bytes:

**Important Note this is a highly specific case when the data is highly entropic and when the compressed size > uncompressed size then only it fallbacks to stored which is the case for this challenge**

You can read about it more from here 

https://datatracker.ietf.org/doc/html/rfc1951

[1 byte]  — block control flags (BFINAL + BTYPE bits, padded to byte boundary)\
[2 bytes] — LEN  (number of data bytes in this block)\
[2 bytes] — NLEN (one's complement of LEN, used for error checking)\
[... raw data bytes follow ...]


This means even when DEFLATE "stores" data uncompressed, those 5 bytes shift the offset of your known plaintext inside the stream. So if you're doing a plaintext attack against a Deflate-encrypted entry, you can't just say "my PNG starts at byte 0"  you have to account for that 5-byte stored-block header sitting in front, which is why tools like bkcrack expose an `-o` offset flag. My teammate's writeup from RITSEC CTF 2026 walks through exactly this harder case  they had to align PNG file headers inside a DEFLATE stream, accounting for stored-block overhead and everything. If you want to see how that plays out in a real challenge, [check it out here](https://medium.com/@wireshark.pcap/ritsec-ctf-2026-zipped-up-writeup-by-wireshark-pcap-b2979b696bae).

For our lab today, both files are **Stored** (no compression, no DEFLATE wrapping), which means the raw bytes start right after the 12-byte ZipCrypto header  clean and direct.


---

## Tool We'll Use: bkcrack

**bkcrack** implements the Biham & Kocher (1994) known-plaintext attack on ZipCrypto. It recovers the three internal cipher keys directly, which is sufficient to decrypt the archive entirely.

- GitHub: [https://github.com/kimci86/bkcrack](https://github.com/kimci86/bkcrack)

Also worth reading:
- [ZipCrypto plaintext attack wiki (anter.dev)](https://wiki.anter.dev/misc/plaintext-attack-zipcrypto/)
- [Also a Good video by John Hammond on this ](https://www.youtube.com/watch?v=2jYorjzHsJ8)
- Biham & Kocher, *"A Known Plaintext Attack on the PKZIP Stream Cipher"* (1994)

---

## The Lab Setup

I created a ZIP archive called `test.zip` containing two files:

- `hosts.txt` — a copy of a standard `/etc/hosts` file (known, predictable content)
- `secret.txt` — the file I want to read, containing a flag

Both were encrypted using **ZipCrypto Store** (no compression). The password is intentionally non-guessable — brute-force tools like `john` or `fcrackzip` with a wordlist would fail here. That's the whole point: we're not guessing the password. We're bypassing it entirely.

---

## Step 1 — Confirm ZipCrypto Store Encryption

The first thing to do is inspect the archive metadata using bkcrack's `-L` flag:

```bash
bkcrack -L test.zip
```

![Info](/check.jpg)

The output confirms two things for each file:
- **Encryption: ZipCrypto** — not AES, so the plaintext attack is viable.
- **Compression: Store** — files are not compressed, meaning the bytes inside the encrypted entry directly correspond to the original file bytes (after the 12-byte header).

Also notice:
- `hosts.txt`: uncompressed size `554`, packed size `566` → difference = **12** (the ZipCrypto header)
- `secret.txt`: uncompressed size `58`, packed size `70` → difference = **12** (same header)

This is the 12-byte overhead in action. Clean, consistent, and exactly as expected.

---

## Step 2 — Prepare the Known Plaintext

Since `hosts.txt` is a standard `/etc/hosts` file, I already know what it starts with. A typical `/etc/hosts` file begins with something like:

```
# Copyright (c) 1993-2009 Microsoft Corp.
```

I took the first N bytes of the actual `hosts.txt` content that I already knew and saved them to a file called `known.txt`. Since the file is stored uncompressed, I can use the raw plaintext bytes directly  no need to worry about DEFLATE or compression offsets.

The more known bytes you provide, the faster and more reliable the attack. I used **34 bytes** of known plaintext here.

---

## Step 3 — Run the Known-Plaintext Attack

With the known plaintext ready, I ran bkcrack against `hosts.txt` inside the archive:

```bash
bkcrack -C test.zip -c hosts.txt -p known.txt
```

![Keys](/keys.jpg)

bkcrack uses the known plaintext to reconstruct the XOR keystream, then works backward through the ZipCrypto state machine to recover the three internal 32-bit keys. The attack took about a minute and returned:

```
Keys: 5250399c eb1de8f5 5899fbc1
```

These are not the password. These are the **internal ZipCrypto cipher state** — but that's all we need. Having these keys is equivalent to having the password for decryption purposes.

---

## Step 4 — Decrypt the Archive

With the recovered keys, I used bkcrack to rewrite the entire archive in decrypted form:

```bash
bkcrack -C test.zip -k 5250399c eb1de8f5 5899fbc1 -D unlocked.zip
```

![Keys](/secret.jpg)

This produces `unlocked.zip` — same files, no encryption. Now I can extract `secret.txt` normally with `unzip` and read the flag.

---


## Step 5 — Recover the Original Password (Optional)

Having the internal keys is already enough to decrypt the archive — but if you're curious about the actual password, bkcrack can brute-force it from the recovered keys:

```bash
bkcrack -k 5250399c eb1de8f5 5899fbc1 -r 8..12 ?a
```

![Keys](/password.jpg)

The `-r 8..12` tells bkcrack to try password lengths between 8 and 12 characters, and `?a` means the charset is all printable ASCII. It came back with:


```
Password: h4rdp4ssw0rd
```

This step is purely optional — the keys were already enough to dump the archive in Step 4. But it's a nice reminder of just how completely ZipCrypto falls apart: not only can you decrypt without the password, you can often recover the password itself afterward too.

---

## Why Brute Force Would Fail Here

Tools like `john` or `fcrackzip` work by guessing the password, hashing it, and checking if decryption succeeds. If the password is long, random, or not in any wordlist, they simply can't crack it in any reasonable time.

The plaintext attack doesn't care about the password at all. It operates directly on the mathematical weakness of ZipCrypto's XOR-based stream cipher. As long as you have ~8–12 bytes of known content in one of the encrypted files, you're in.

---

## The Fix: Use AES-256

If you're encrypting a ZIP file and actually need security, use AES-256 encryption. Most modern ZIP tools support it:

```bash
# 7-zip
7z a -p -mem=AES256 encrypted.zip files/

# zip (with AES via p7zip or similar)
zip --encrypt --password yourpassword -Z aes256 out.zip file
```

AES-256 is not vulnerable to this attack. The plaintext attack is **specific to ZipCrypto** and the way it handles its key schedule. With AES, there's no internal key state to reconstruct from known plaintext in this way.

---

## Closing Thoughts

ZipCrypto is a relic. It was designed in an era when computational security constraints were very different, and it shows. The known-plaintext attack has been known since 1994 — that's over 30 years ago  and yet ZipCrypto is still the default in many tools today.

The takeaway is simple:
- **ZipCrypto Store** → broken, plaintext attack works directly
- **ZipCrypto Deflate** → harder but not impossible
- **AES-256** → use this


Happy hacking. Stay curious.