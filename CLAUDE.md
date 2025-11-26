# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ultimate Tic-Tac-Toe game built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS 4.

## Development Commands

```bash
# Start development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Architecture

### Framework: Next.js 16 (App Router)

This project uses Next.js App Router architecture:
- `app/layout.tsx` - Root layout with Geist fonts (Sans & Mono) and global styles
- `app/page.tsx` - Home page component
- `app/globals.css` - Global Tailwind CSS styles

### Styling: Tailwind CSS 4

- Uses Tailwind CSS 4 with the new PostCSS plugin (`@tailwindcss/postcss`)
- Supports dark mode via `dark:` class variants
- Custom fonts defined via CSS variables: `--font-geist-sans` and `--font-geist-mono`

### TypeScript Configuration

- Strict mode enabled
- Path alias: `@/*` maps to root directory
- Target: ES2017
- JSX: react-jsx (no need for React imports in components)

### Code Style

- ESLint configured with Next.js core web vitals and TypeScript rules
- Uses flat config format (`eslint.config.mjs`)

## Project Structure

```
app/              # Next.js app directory (routes and layouts)
public/           # Static assets (SVG icons)
```

## Important Notes

- React 19 is used - be aware of any breaking changes from React 18
- Tailwind 4 syntax may differ from v3 (check official migration guide if needed)
- All React components are Server Components by default; use 'use client' directive for client components
- Image optimization via `next/image` is already set up in the starter template
