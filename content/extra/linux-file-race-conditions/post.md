---
title: Understanding Linux File Race Conditions
date: 2026-07-02
tags:
  - Linux
  - Race Condition
  - Go
summary: Explores how Linux file race conditions arise from concurrent writes, covering inodes, file descriptors, open file descriptions, file offsets, `O_TRUNC`, and how unsynchronized file operations can lead to unexpected filesystem behavior.
---

# From open(2) to XSS: Understanding a File Descriptor Race Condition in Go

## Introduction

This post walks through a race condition vulnerability class that shows up in web applications which write user-controlled data directly to a file on disk. The example here is based on a CTF-style challenge ("note" service) where a server sanitizes user input before saving it, but the sanitization can be bypassed because of how concurrent requests interact with the filesystem at the syscall level.

Rather than just showing the exploit, this post focuses on building the mental model from the ground up: what a file actually is to Linux, what a file descriptor is, what an offset is, why `O_TRUNC` behaves the way it does, and how all of that combines to create an exploitable race.

If you've ever wondered what's really happening when two requests hit the same file at the same time, this is for you.

## The Vulnerable Pattern

The vulnerable service works roughly like this:

1. A client creates a "note" and gets back an identifier.
2. The client can `PUT` a new message to that note. The server sanitizes the message (for example, stripping or escaping `<` characters to prevent XSS) and writes the sanitized result to a file on disk, identified by the note's ID.
3. The client can `GET` the note, which reads the file back and returns its contents.

The relevant part of the server's write handler looks conceptually like this (Go):

```go
f, err := os.OpenFile(filePath, os.O_WRONLY|os.O_TRUNC, 0644)
if err != nil {
    return err
}
defer f.Close()

_, err = f.Write([]byte(sanitized))
if err != nil {
    return err
}
```

On the surface this looks fine. Every write opens the file with `O_TRUNC` (so old content is wiped), writes the new sanitized content, and closes it. There's no obvious way to inject something the sanitizer rejected.

The problem is that this handler is not synchronized. If two `PUT` requests arrive at nearly the same time, they each get their own file descriptor, and nothing stops their `write()` calls from interleaving. That's the entire bug, and the rest of this post is about understanding exactly why that interleaving is possible and what it actually produces.

## Building the Mental Model: What Is a File, Really?

To understand the race, you have to stop thinking about "the file" as a single thing that requests take turns using, and instead think about the actual kernel objects involved.

### Inodes

A file on disk, as far as the kernel is concerned, is represented by an **inode**. The inode stores metadata: size, permissions, ownership, and pointers to where the actual data lives on disk. The filename you see (`note.txt`, or whatever the note ID is) is just an entry in a directory that points at an inode number.

```
note.txt  ----points to---->  inode #1432
                                  size = 5
                                  data -> [Hello]
```

Multiple filenames can point to the same inode (hard links), and the filename itself carries no data it's purely a pointer.

### File Descriptors and Open File Descriptions

This is the part that trips most people up, because "file descriptor" gets used loosely to mean several different things.

When a process calls `open()`, the kernel does **not** hand back a direct reference to the inode. Instead, per the [`open(2)` man page](https://man7.org/linux/man-pages/man2/open.2.html):

> A call to `open()` creates a new open file description, an entry in the system-wide table of open file descriptions. The open file description records the file offset and the file status flags.

So there are actually three layers involved:

```
file descriptor (an integer, e.g. 3)
        |
        v
open file description (kernel object: offset, flags)
        |
        v
inode (the actual file: size, data, metadata)
```

The **file descriptor** is just a small integer that indexes into your process's per-process table of open files. Entry 0 is usually stdin, 1 is stdout, 2 is stderr, and anything you open yourself gets the next free number.

The **open file description (OFD)** is the real kernel object. It's created fresh every single time you call `open()`, and it holds two important things: the current **file offset**, and the flags the file was opened with (read/write mode, append mode, etc).

Think of the open file description as the kernel's "state" for one particular `open()` call. It stores information that changes while the file is in use the current offset, the access mode flags while the inode stores information about the file itself: its size, permissions, timestamps, and the data blocks on disk. The OFD is temporary and tied to a session of use; the inode is the persistent thing being used.

The **inode** is the actual file the data and metadata that both descriptions ultimately point at.

This three-layer separation is the entire reason the race condition is possible. Two different `open()` calls on the same path produce two different open file descriptions, each with its own independent offset, both pointing at the same underlying inode.

A simple diagram makes this concrete. Two separate processes (or two separate goroutines/threads handling two separate requests) each calling `open()` on the same path get two completely independent OFDs:

```
Process / Request A                Process / Request B

fd = 5                              fd = 6
  |                                   |
  v                                   v
OFD A                               OFD B
offset = 0                          offset = 0
flags = O_WRONLY|O_TRUNC            flags = O_WRONLY|O_TRUNC
  |                                   |
  +----------------+   +--------------+
                   |   |
                   v   v
              inode #1432 (note.txt)
              size, permissions, data
```

Why doesn't the kernel just share one offset for everyone accessing the same file? Because sharing offsets would make independent callers interfere with each other in ways they don't expect. If two unrelated processes opened the same log file to append to it, and they shared a single offset, one process's read or write would silently move the other's cursor too. By giving every `open()` call its own open file description, each reader or writer gets its own private cursor, and that cursor only becomes shared when a process explicitly asks for that for example via `dup()` (which duplicates a file descriptor but makes it point at the _same_ OFD), or via `fork()` (where a child process inherits the parent's file descriptors, again pointing at the same OFDs). Calling `open()` twice, independently, never gives you a shared OFD. That's exactly the situation in this vulnerability: every HTTP request handler calls `open()` fresh, so every request gets its own offset, with no relationship to any other request's offset.

## What Is an Offset, Concretely?

The offset is simply the position in the file where the next `read()` or `write()` will start. Think of it as a cursor.

Take a file containing:

```
Hello World
```

with byte positions:

```
H  e  l  l  o     W  o  r  l  d
0  1  2  3  4  5  6  7  8  9  10
```

If you `open()` the file, your offset starts at 0. Calling `read(fd, buf, 5)` reads `Hello` and advances your offset to 5. The next `read()` would start at position 5 and return ` World`.

`lseek()` lets you move that cursor manually. From the [`lseek(2)` man page](https://man7.org/linux/man-pages/man2/lseek.2.html):

> `lseek()` repositions the file offset of the open file description associated with the file descriptor `fd` to the argument `offset` according to the directive `whence`.

Notice the wording: it repositions the offset **of the open file description**, not of the file itself, and not of the file descriptor in some shared global sense. This is the man page directly confirming that the offset lives on the OFD object, which is per-`open()`-call, not per-inode.

## What `O_TRUNC` Actually Does

From the `open(2)` man page, when `O_TRUNC` is specified and the file exists and is opened for writing, the file is truncated to length 0 as part of the `open()` call itself not on `write()`, and not on `close()`.

This timing detail matters enormously. The sequence for any single request is:

```
open(path, O_WRONLY | O_TRUNC)
    -> kernel truncates the inode to size 0
    -> kernel creates a new OFD with offset = 0

write(fd, data, len)
    -> kernel writes 'len' bytes starting at the current offset
    -> offset advances by 'len'

close(fd)
    -> releases the file descriptor
    -> does NOT touch the file size or contents at all
```

`close()` is often assumed to do some kind of finalization or truncation. It doesn't. Once `write()` has put bytes into the file, `close()` is just bookkeeping releasing the descriptor. The file's contents are whatever the writes left behind.

This is worth stating as plainly as possible, because it is probably the single biggest misconception people bring into this topic, second only to the offset confusion covered later:

```
TRUNCATION HAPPENS HERE:        open()
                                   |
                                   v
                              (file size -> 0)

NOT HERE:                       close()
                                   |
                                   v
                              (no effect on size or content)
```

If you remember nothing else from this section, remember that `O_TRUNC` is evaluated once, at the moment `open()` is called. Everything that happens afterward any number of `write()` calls, and the eventual `close()` has no further truncating effect. This is exactly what makes the race possible: once a file has been truncated and a new open file description exists for it, any other write that lands on that inode before the next truncation gets to contribute to the final content.

## Why Two Concurrent Requests Don't Share Anything

Now put two requests side by side. Suppose Request A and Request B both hit the `PUT` handler at nearly the same time.

```
Request A                          Request B
----------                         ----------
open(O_TRUNC)                      open(O_TRUNC)
  -> OFD_A created                   -> OFD_B created
  -> offset_A = 0                    -> offset_B = 0
  -> inode truncated to size 0       -> inode truncated to size 0 (already empty)
```

Both now hold independent open file descriptions, both pointing at the same inode, both starting at offset 0:

```
                inode (note content)
               /                    \
          OFD_A                    OFD_B
        offset = 0                offset = 0
```

Critically: **neither request knows the other exists.** There is no mutex around the file, no `flock()`, no advisory lock, nothing serializing access. The Go runtime, like most language runtimes, calls straight through to the Linux `open(2)` and `write(2)` syscalls without adding any synchronization of its own the Zenn article on the Go `io` package traces exactly this path: `os.OpenFile()` -> `syscall.Open()` -> the `open(2)` syscall, and `File.Write()` -> `syscall.Write()` -> the `write(2)` syscall. Go isn't doing anything special here; it's a thin wrapper around the same kernel primitives that C, Rust, Python, Node, and Java all eventually call into.

So once both requests are inside their respective `write()` calls, the kernel is free to interleave them however its scheduler and filesystem implementation see fit, because nothing in the application told it not to.

## The Part That Actually Confuses People: How Does Interleaving Produce a Hybrid Result?

This is worth being precise about, because the naive "cursor" explanation is not sufficient on its own, and it's easy to convince yourself of something that isn't quite right.

A common (incorrect) mental model is: "Request A writes its one byte, its offset becomes 1, then somehow Request B starts writing from offset 1 too, so the rest of B's payload lands after A's byte." That is **not** what happens. B's offset is its own; it never becomes 1 just because A's offset became 1. If B writes after A with its own offset still at 0, B writes starting at byte 0, overwriting A's byte.

The actual mechanism is about the **order and timing** of two independent writes, not about shared cursors. The important thing to internalize is that there is no single fixed order in which Request A and Request B's `open()`/`write()`/`close()` calls happen. With two requests racing, there are many possible interleavings of those operations, and the kernel scheduler is free to pick essentially any of them on any given attempt. Most of those interleavings produce an unremarkable result: the file ends up containing one request's payload in full, with the other's contribution either overwritten entirely or never observed. Only a narrow subset of orderings produces the specific hybrid result an attacker wants which is exactly why this kind of exploit is run thousands of times in a loop rather than expected to succeed on the first try.

Suppose the payloads are deliberately asymmetric in length: a long payload that starts with a throwaway character, and a short one-byte payload meant to overwrite just that first character.

```
Request B (long payload):  "Aimg src=x onerror=...>"
Request A (short payload): "<"
```

One possible interleaving a losing one for the attacker looks like this:

```
1. Request A: open(O_TRUNC)      -> file size 0, OFD_A offset = 0
2. Request A: write("<")         -> file now contains "<"
3. Request B: open(O_TRUNC)      -> file size 0 again (re-truncated!)
4. Request B: write("Aimg ...")  -> file now contains "Aimg src=x onerror=...>"
```

Here B's `open()` truncates the file after A already wrote, and B's full write lands last and overwrites everything. The result is just B's payload, unmodified by the sanitizer-bypassing trick. This is the most common outcome.

The interleaving the attacker is actually looking for is the one where Request A's `open()` (with its truncation) happens **before** Request B writes its full payload, but Request A's one-byte `write()` happens **after** Request B's `write()` has already landed the full payload, and nothing truncates the file again in between:

```
1. Request B: open(O_TRUNC)        -> file size 0
2. Request A: open(O_TRUNC)        -> file size 0 (no-op, already empty)
3. Request B: write("Aimg ...>")   -> file = "Aimg src=x onerror=...>"
4. Request A: write("<")           -> overwrites only byte 0
                                       file = "<img src=x onerror=...>"
5. Both requests close() (no effect on content)
```

Because `write()` only touches the bytes it's given, starting at its own offset, Request A's single-byte write at offset 0 replaces only the leading `A`, leaving the rest of Request B's payload untouched. The result is a string that was never produced by either sanitizer pass in isolation: `<img src=x onerror=...>` a complete, sanitizer-bypassing payload assembled from two separately-sanitized writes.

To be precise about what POSIX and the Linux man pages actually guarantee here: they describe the offset and truncation semantics covered above, but they do not make strong guarantees about the byte-level visibility of two unsynchronized concurrent writes to the same inode. The safer way to phrase the outcome is that concurrent, unsynchronized writes can leave the final file reflecting a combination of operations from different requests, rather than the logical output of either request in isolation. The specific four-step ordering above is one way of describing a winning race, but the exact mechanics of how the kernel's page cache resolves overlapping writes are an implementation detail below what `open(2)` and `lseek(2)` document.

### Why the Payload Starts With a Throwaway Character

This detail is worth calling out on its own, because it's the cleverest part of the exploit construction.

```
"Aimg src=x onerror=...>"
        |
        | Request A's one-byte write replaces only byte 0
        v
"<img src=x onerror=...>"
```

If the long payload were submitted starting with `<` directly, the sanitizer would see `<img src=x onerror=...>` as a single piece of input and strip or escape the `<`, exactly as it's designed to do. The exploit avoids that entirely by never sending `<` as part of the long payload. Instead, the long request submits a harmless-looking placeholder character commonly written as `A`, `B`, `X`, or similar in the position where `<` eventually needs to be. That request passes the sanitizer cleanly, because there's nothing in it for the sanitizer to object to.

The actual `<` is sent separately, in its own minimal one-byte request. On its own, that request is also harmless from the sanitizer's point of view a single `<` with no tag name or attributes after it isn't a meaningful HTML injection by itself, and depending on the sanitizer's logic it may pass through untouched or be the only thing checked in that request.

Neither request, individually, ever contains a complete malicious payload. The dangerous content only comes into existence as a side effect of the race: one request's first byte landing on top of the other request's already-written, longer payload. This is what makes the bug a genuine bypass rather than just a sanitizer bug the sanitizer is doing its job correctly on every individual request it sees.

## Why This Isn't Go-Specific

Nothing about this relies on Go internals. Since the original code is Go, it's worth tracing exactly how its standard library calls map down to the syscalls discussed above. According to the Go `io` package internals article referenced below, the path looks like this:

```
os.OpenFile()
     |
     v
openFileNolog()
     |
     v
syscall.Open()
     |
     v
Linux open(2)
     |
     v
new Open File Description created (offset = 0, O_TRUNC applied)
```

and for writing:

```
File.Write()
     |
     v
poll.FD.Write()
     |
     v
syscall.Write()
     |
     v
Linux write(2)
     |
     v
bytes copied into the file starting at the OFD's current offset
```

Go's `os.File` is a thin wrapper that does essentially no buffering or synchronization of its own around these calls it hands the work straight to the kernel. The broader chain of causality, generalized across languages, is:

```
Application code
     |
     v
Language runtime (os.OpenFile / fopen / fs.open / File.write / etc.)
     |
     v
libc or runtime I/O layer
     |
     v
Linux syscalls: open(2), write(2), close(2)
     |
     v
Kernel VFS layer -> inode -> page cache -> disk
```

Any language whose I/O ultimately bottoms out in unsynchronized calls to `open()`/`write()` against the same path is structurally capable of exhibiting this race: C, C++, Rust, Python, Java, PHP, Node.js, and so on. The exact probability of winning the race differs because each runtime schedules and times its I/O differently (goroutines vs. OS threads vs. libuv's thread pool vs. native pthreads), but the underlying kernel behavior independent open file descriptions, independent offsets, no implicit locking is identical across all of them.

Runtimes that avoid this class of bug typically do so by writing to a temporary file and then using an atomic `rename()` to replace the target, or by using explicit locking (`flock()`, a mutex, a per-resource queue) around the read-modify-write sequence. Neither of those protections was present in the vulnerable handler.

## Summary of the Root Cause

Stripped of CTF framing, the vulnerability is:

- The server writes user-controlled content directly to a file named after a resource ID.
- Each write request independently calls `open()` with `O_TRUNC`, which creates a brand-new open file description with its own offset, and immediately truncates the file at open time (not at write or close time).
- Concurrent requests are not synchronized in any way no mutex, no file lock, no per-resource queue.
- Because `close()` does not re-truncate or finalize the file, two requests racing on the same file can, under the right interleaving, leave the final on-disk content reflecting a combination of both requests' writes rather than the output of either one in isolation.
- An attacker can exploit this by sending one request with a long, mostly-malicious payload containing a sacrificial leading byte, and a second request consisting of just the single character the sanitizer would normally reject, timed to land its write after the first request's write completes but before any subsequent truncation. The result is a file containing a sanitizer-bypassing payload that no single request ever submitted.

## Mitigations

For anyone building something similar, the fixes are straightforward:

- **Serialize writes per resource.** A mutex (or a more granular per-note-ID lock) around the open-write-close sequence prevents any interleaving.
- **Use advisory file locks** (`flock()`) if multiple processes (not just goroutines/threads within one process) might write the same file.
- **Write atomically.** Write to a temporary file and `rename()` it over the target. `rename()` on the same filesystem is atomic from the perspective of readers they either see the old file or the new one, never a mix.
- **Sanitize on read as well as write**, as defense in depth, so that even if a malformed file somehow gets written, it's not served back unsanitized.

## References

- [`open(2)` Linux manual page](https://man7.org/linux/man-pages/man2/open.2.html)
- [`lseek(2)` Linux manual page](https://man7.org/linux/man-pages/man2/lseek.2.html)
- [Go io package internals (Japanese) Zenn](https://zenn.dev/hsaki/books/golang-io-package/viewer/file)

## Proof of Concept / Solver

_(Space reserved insert your solver script here.)_

```python
import threading
import requests

url = "https://ltw.chals.sekai.team"

def create():
    return requests.post(url + "/create", data={"message": "hi"}, allow_redirects=False).headers["Location"][7:]

def edit(i, m):
    requests.put(url + "/notes/" + i, data={"message": m}, allow_redirects=False)

def note(i):
    return requests.get(url + "/notes/" + i).text

i = create()
for x in range(5000):
    l = threading.Thread(target=edit, args=(i, "ximg src=x onerror=console.log(document.cookie)>"))
    s = threading.Thread(target=edit, args=(i, "<"))
    l.start()
    s.start()
    l.join()
    s.join()
    if note(i).startswith("<img src=x onerror=console.log(document.cookie)>"):
        print(url + "/notes/" + i)
        break
```
