# Deployment guides

Two supported paths, pick one:

| Guide | Best for | Effort | Monthly cost |
| --- | --- | --- | --- |
| **[HOSTINGER.md](./HOSTINGER.md)** | Non-technical teams, minimal ops | Low | ~$3-5 |
| **[VPS.md](./VPS.md)** (Contabo / Hetzner / DigitalOcean) | Teams comfortable with SSH, full control | Medium | ~$4-6 |

## Common post-deploy tasks

- **[POST_DEPLOY_SEED.md](./POST_DEPLOY_SEED.md)** — seed / re-seed the admin
  user in production, rotate the temp password, create additional admins.

## Reference files

- **[nginx.conf](./nginx.conf)** — production-ready nginx server block for
  the VPS path. Copy to `/etc/nginx/sites-available/`.

## Pre-flight checklist (both paths)

- [ ] MySQL 8+ / MariaDB 10.6+ available
- [ ] PHP 8.3 with `pdo_mysql, mbstring, xml, curl, zip, gd, intl, bcmath,
      fileinfo` extensions
- [ ] Composer 2 installed
- [ ] Node 20+ + npm (only if you build assets on the server; can build locally instead)
- [ ] Domain A-record pointing at the server IP
- [ ] Google Workspace **App Password** ready (for SMTP invites)
- [ ] SSL cert plan (Let's Encrypt on VPS, AutoSSL on Hostinger)
- [ ] Backup destination decided
