<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a6e4f5ae-0828-45e1-8839-e90b0542809d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## ⚠️ REGLA CRÍTICA DE PERSISTENCIA DE DATOS (BASE DE DATOS)
> **¡IMPORTANTE!** La base de datos PostgreSQL contiene información real y persistente de negocio.
> - **NUNCA** utilices comandos destructivos como `prisma migrate reset`, `prisma db push --force-reset` o sentencias SQL `DROP DATABASE` / `DROP SCHEMA` / `TRUNCATE` en entornos con datos reales.
> - Todos los cambios estructurales deben gestionarse exclusivamente mediante **migraciones incrementales y no destructivas** (`npx prisma migrate dev --name <nombre>`).
> - Los scripts de semilla (`seed.ts`) deben mantenerse **idempotentes**, sin realizar limpiezas masivas (`deleteMany()`).
