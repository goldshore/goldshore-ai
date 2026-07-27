# HostGator cPanel mail access

## Current connectivity

The local SSH alias `hostgator` reaches `gator3003.hostgator.com` using an
SSH key. The remote account exposes cPanel 118, `uapi`, `doveadm`, and a
Maildir tree under the account home.

## Operating model

- Use SSH and cPanel UAPI for mailbox inventory, quota checks, forwarders,
  filters, logs, and controlled administration.
- Use authenticated IMAP for reading or synchronizing messages.
- Use authenticated SMTP for transactional sending.
- Do not parse Maildir files from application code or expose SSH to a Worker.
- Keep SSH private keys and mailbox passwords outside the repository. Store
  application credentials as scoped Cloudflare Worker secrets.
- Prefer a dedicated mailbox and app-specific password for automation.

## Connection commands

```powershell
& 'C:\Program Files\Git\usr\bin\ssh.exe' hostgator
```

Read-only mailbox inventory:

```bash
uapi --output=jsonpretty Email list_pops
uapi --output=jsonpretty Email list_forwarders
doveadm quota get -A
```

Before integrating mail with `gs-api`, confirm the intended mailbox, whether
the workflow is read-only or send-and-receive, and the server's SSL IMAP/SMTP
hostnames from cPanel. Use IMAP/SMTP credentials, not the cPanel account
password.
