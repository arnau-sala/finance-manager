# Public Assets

Files in this folder are served from the web root.

Place the iOS home-screen icon here:

```text
apps/web/public/apple-touch-icon.png
```

It will be available as:

```text
/apple-touch-icon.png
```

Required format:

- PNG
- `180x180px`
- Square
- No transparency
- No rounded corners
- Solid background
- Centered symbol with safe internal padding

After replacing it, remove the old icon from the iPhone home screen and add the web app again because iOS caches home-screen icons aggressively.

When the icon changes, also update the version query used by the icon links in `index.html` and `manifest.webmanifest`. This forces iOS to request the new asset instead of reusing a cached Web Clip icon.

For iPhone testing through a VS Code forwarded port, expose only frontend port `5173` and set its port visibility to `Public`. A private tunnel redirects unauthenticated icon requests to GitHub sign-in, so iOS falls back to a letter icon even when Safari can open the PNG in an authenticated tab. Keep the API and Prisma Studio ports private.
