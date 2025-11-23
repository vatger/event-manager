# Banner Generator Font Configuration

## Overview

The CPT Banner Generator uses custom Montserrat fonts to render banners dynamically via the `/api/cpt-banner/generate` endpoint. This document explains the font setup and common troubleshooting steps.

## Font Files

The banner generator requires two font files located in `public/fonts/`:

- `Montserrat-Bold.ttf` - Registered as `MontserratBold`
- `Montserrat-ExtraBold.ttf` - Registered as `MontserratExtraBold`

These fonts are used for rendering:
- Controller names
- Dates and times
- Weekdays
- Station codes

## Docker Configuration

### Required Alpine Packages

The Dockerfile includes the following packages to support font rendering with the `canvas` library:

```dockerfile
RUN apk add --no-cache \
  cairo \
  pango \
  jpeg \
  giflib \
  libpng \
  freetype \
  fontconfig \
  font-misc-misc \
  ttf-dejavu \
  font-noto \
  && fc-cache -f
```

- `cairo`, `pango` - Core rendering libraries
- `jpeg`, `giflib`, `libpng` - Image format support
- `freetype` - Font rendering engine
- `fontconfig` - Font configuration and discovery
- `font-misc-misc`, `ttf-dejavu`, `font-noto` - Fallback system fonts
- `fc-cache -f` - Rebuilds the font cache

### Public Folder Copy

The Dockerfile **must** copy the public folder from the builder stage to ensure fonts are included:

```dockerfile
COPY --from=builder /app/public ./public
```

❌ **Incorrect**: `COPY public ./public` (copies from build context, may miss files)
✅ **Correct**: `COPY --from=builder /app/public ./public` (copies from builder stage)

## Troubleshooting

### Fonts Not Rendering Correctly

If fonts appear different between development and production (Docker), check:

1. **Verify fonts are in the Docker image**:
   ```bash
   docker exec <container-name> ls -la /app/public/fonts/
   ```
   
   Expected output:
   ```
   -rw-r--r-- 1 root root 335788 Montserrat-Bold.ttf
   -rw-r--r-- 1 root root 344052 Montserrat-ExtraBold.ttf
   ```

2. **Check font registration logs**:
   The API route logs font registration on startup. Look for:
   ```
   ✅ Fonts registered successfully
   📝 Registered font families: MontserratBold, MontserratExtraBold
   ```

3. **Verify font packages are installed**:
   ```bash
   docker exec <container-name> fc-list | grep -i montserrat
   ```

4. **Check current working directory**:
   The API logs the current working directory. Ensure it matches `/app`:
   ```
   📁 Current working directory: /app
   ```

### Common Issues

#### Issue: Fonts not found
**Error**: `❌ Font not found: /app/public/fonts/Montserrat-Bold.ttf`

**Solution**: 
- Ensure Dockerfile uses `COPY --from=builder /app/public ./public`
- Rebuild the Docker image: `docker build -t event-manager .`

#### Issue: Different font rendering
**Symptoms**: Text appears in different font or wrong proportions

**Solution**:
- Install missing font packages in Dockerfile
- Run `fc-cache -f` after installing font packages
- Verify Alpine has required font rendering libraries (cairo, pango, freetype)

#### Issue: Font cache not updated
**Symptoms**: Fonts work locally but not in Docker

**Solution**:
- Add `fc-cache -f` to Dockerfile after installing font packages
- This rebuilds the font cache to recognize newly installed fonts

## Development vs Production

### Development (localhost)
- Uses system fonts or fonts loaded from `public/fonts/`
- Font rendering handled by OS-native libraries
- May have more font fallbacks available

### Production (Docker/Alpine)
- Limited font selection (Alpine Linux)
- Requires explicit font installation
- Font cache must be built with `fc-cache`
- Custom fonts must be in `public/fonts/` and copied to container

## Font Registration Code

The font registration happens in `/app/api/cpt-banner/generate/route.ts`:

```typescript
registerFont(boldPath, {
  family: 'MontserratBold'
});

registerFont(extraBoldPath, {
  family: 'MontserratExtraBold'
});
```

Font family names **must** match exactly with template configuration in `templateConfig.ts`.

## Testing Locally

To test font loading locally:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test banner generation
curl "http://localhost:3000/api/cpt-banner/generate?template=APP&name=Test&date=2024-12-15&time=12:34" -o test-banner.png
```

## Testing in Docker

```bash
# Build the image
docker build -t event-manager .

# Run the container
docker run -p 8000:8000 event-manager

# Test banner generation
curl "http://localhost:8000/api/cpt-banner/generate?template=APP&name=Test&date=2024-12-15&time=12:34" -o test-banner.png

# Verify fonts in container
docker exec <container-name> ls -la /app/public/fonts/
```

## Adding New Fonts

To add a new font:

1. Place the `.ttf` file in `public/fonts/`
2. Register the font in `ensureFontsRegistered()` function:
   ```typescript
   registerFont(join(publicDir, 'fonts', 'YourFont.ttf'), {
     family: 'YourFontFamily'
   });
   ```
3. Update template config to use the new font family
4. Rebuild Docker image to include the new font

## Related Files

- `Dockerfile` - Font package installation and public folder copy
- `app/api/cpt-banner/generate/route.ts` - Font registration and banner generation
- `app/admin/edmm/cpt-banner/templateConfig.ts` - Font configuration per template
- `public/fonts/` - Font file storage
