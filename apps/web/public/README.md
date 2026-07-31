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

Portrait launch screens are stored in:

```text
apps/web/public/apple-startup/
```

Their dimensions and media queries must stay synchronized with the
`apple-touch-startup-image` links in `index.html`. After changing these images,
remove and add the home-screen app again because iOS stores launch assets as
part of the installed Web Clip. Each image uses a white background with the app
icon at the same rendered size as the first HTML frame. The native and HTML
startup surfaces intentionally contain only that icon. The HTML layer freezes
the standalone viewport compensation before its first paint so the icon keeps
the native position while WebKit initializes. Its pre-sized raster is embedded
directly in `index.html`, avoiding an icon request or decode gap during the
native-to-web handoff. React removes that exact element only after the
destination is ready.

For iPhone testing through a VS Code forwarded port, expose only the active
frontend port (`5173` for development or `5174` for production preview) and set
its visibility to `Public`. A private tunnel redirects unauthenticated icon
requests to GitHub sign-in, so iOS falls back to cached or generated artwork
even when Safari can open the PNG in an authenticated tab. Keep the API and
Prisma Studio ports private.
