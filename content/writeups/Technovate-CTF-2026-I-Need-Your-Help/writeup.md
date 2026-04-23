---
title: I Need Your Help
ctf: Technovate CTF 2026
date: 2026-04-02
tags:
  -  OSINT
summary: Tracked a suspicious digital identity across multiple platforms (Twitter → Google Reviews → Instagram → LinkedIn → GitHub) and decoded a Vigenère cipher using the provided key to recover the final flag.
---

#  I Need Your Help — Writeup

##  Challenge Description

>An alien has infiltrated human society and is attempting to blend in by stealing human identities. It has already begun leaving traces online, posting reviews, maintaining social media accounts, and pretending to live a normal digital life. While investigating unusual activity linked to my own identity, I discovered that the entity is active on Social Media Platform as mopy456345.
>
>Your task is to track this entity’s digital footprint, uncover where it is hiding, and >follow the trail it leaves behind.
>
>its already learned trickery. Be careful, the alien is learning fast.
>
>You will need TCHNVTE somewhere else other than the flag format
>
>Format - TCHNVTE{...}

we can pin point an username `mopy456345`

---

##  Approach Overview

This was a **multi-platform OSINT challenge** involving:

* Social media tracking
* Clue chaining across platforms
* Cipher decryption (Vigenère)

The challenge flow was:

```
Twitter → Google Review → Instagram → LinkedIn → GitHub → Cipher → Flag
```

---

##  Step 1: Finding the Twitter Profile

We started by searching for the username:

```
mopy456345
```

This led us to a Twitter (X) profile.

 ![Alt Text](xid.jpg)

Inside the profile, we found a **post containing an image of Mount Everest**.

---

##  Step 2: Pivot to Google Reviews

From the challenge description, we were hinted about:

> "posting reviews"

Since the image showed **Mount Everest**, we searched for nearby locations and found:

```
Hillary Step
```

We checked the **Google Reviews** of Hillary Step.

 ![Alt Text](goggle-review.jpg)

Among the reviews, we found a suspicious one containing a clue:

 It revealed an **Instagram username**:

```
malien442
```

---

##  Step 3: Instagram Investigation

We searched for the Instagram account:

```
malien442
```

 ![Alt Text](instaid.jpg)

In the bio of the Instagram profile, we found a **LinkedIn profile link**.

---

##  Step 4: LinkedIn Trail

We visited the LinkedIn profile from the Instagram bio.

  ![Alt Text](linkedin.jpg)

On this profile, we discovered another **iamalien442-star**.

We searched for this username and found:

 A **GitHub profile**


---

##  Step 5: GitHub Analysis

We accessed the GitHub repository:

```
https://github.com/iamalien442-star/project_starfall
```

  ![Alt Text](github.jpg)

Inside the repository, we checked the `README.md` file and found a **cipher text**:

```
MEOAQMI{13m_Ol_90_UjF3}
```

---

##  Step 6: Cipher Decryption

The challenge description provided an important hint:

> "You will need TCHNVTE somewhere else other than the flag format"

This strongly suggested a **Vigenère Cipher** with key:

```
TCHNVTE
```

We decrypted the ciphertext:

```
MEOAQMI{13m_Ol_90_UjF3}
```

Using Vigenère Cipher with key `TCHNVTE`, we obtained:

---

##  Final Flag

```
TCHNVTE{13t_Me_90_HoM3}
```

---

##  Key Takeaways

* Always follow **contextual hints** in OSINT challenges
* Images often act as **pivot points**
* Cross-platform tracking is essential (Twitter → Maps → Instagram → LinkedIn → GitHub)
* When a key is explicitly mentioned, think of **classical ciphers** like Vigenère

PWN by **W4RR1OR**
