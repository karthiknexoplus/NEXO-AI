# Long chat streams (“Load failed”)

NEXOPLUS streams AI replies over **Server-Sent Events** on `/api/intelligence/chat`.

## On the VM (nginx)

`deploy/nginx-ai.nexoplus.in.conf` already sets:

- `proxy_read_timeout 3600s` for `/api/`
- `proxy_buffering off`

After editing: `sudo nginx -t && sudo systemctl reload nginx`

## AIC Cloud / external edge

If the public URL (`https://ai.nexoplus.in`) terminates **before** your VM nginx, that layer must allow **long-lived** connections (often 60–120s default).

Ask support to raise **read / idle timeout** for your domain to **at least 600s**, or route API traffic directly to port **3080** with SSE-friendly settings.

## App-side

On the VPS `cloud.conf` (optional):

```ini
Environment=NEXO_CLOUD_TIMEOUT_MS=600000
```

Restart: `sudo systemctl restart nexoplus-web`
