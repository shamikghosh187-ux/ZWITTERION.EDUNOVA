# Zwitterion modern UI workspace

This is an isolated React/Vite workspace for evaluating the new student experience without replacing the current production `index.html`.

## Run locally

```bash
cd modern-ui
npm install
npm run dev
npm run build
```

Uses `lucide-react` for icons and `framer-motion` for subtle motion. This UI workspace intentionally uses sample dashboard content only: production Supabase, private PDF downloads, and admin flows remain in the existing app until they are migrated and tested explicitly.
