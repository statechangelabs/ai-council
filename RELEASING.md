# Release Process

Follow these steps for every release:

1. **Commit all changes** with a descriptive message
2. **Bump version** in `package.json` (semver: patch for fixes, minor for features, major for breaking changes)
3. **Build** — `bun run build` (CLI) and `bun run build:gui` (Electron)
4. **Publish to NPM** — `npm publish --access public`
5. **Push to GitHub** — `git push origin main`
6. **Create GitHub release** — `gh release create vX.Y.Z --generate-notes`
