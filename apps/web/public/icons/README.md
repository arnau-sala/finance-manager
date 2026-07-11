# App Icon

Place the app icon PNG in this folder with this exact name:

```text
app-icon.png
```

Recommended source format:

- PNG
- Square image
- `1024x1024px`
- No transparency if possible
- Keep the main symbol centered with safe padding so it works as a maskable PWA icon

Generated icon assets:

- `../apple-touch-icon.png`: `180x180px`, no transparency, used by iOS home-screen installs.
- `app-icon-192.png`: `192x192px`, no transparency, used by the PWA manifest.
- `app-icon-512.png`: `512x512px`, no transparency, used by the PWA manifest.
- `favicon-32.png`: `32x32px`, used by browser tabs.

The iOS icon intentionally lives one level up, directly inside `public/`, so it is served from `/apple-touch-icon.png`.

The source file is used by:

- The login entry screen logo
- Future icon regeneration
