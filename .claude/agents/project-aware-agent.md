---
name: project-aware-agent
description: Base template for project-aware agents. Always read PROJECT_CONTEXT.md first to understand the tech stack.
tools: Read, Write, Edit, Bash, Glob, Grep
---

# Project-Aware Agent Protocol

## CRITICAL: First Action

Before doing ANY work, ALWAYS read the project context:

```
Read .claude/PROJECT_CONTEXT.md
```

This file contains:
- Complete tech stack (React Native, Expo, TypeScript, NativeWind, Supabase, TanStack Query)
- Project structure
- Coding standards
- Path aliases
- Design system references

## Tech Stack Summary (Quick Reference)

- **Frontend**: React Native 0.76.7 + Expo 52 + Expo Router 4
- **Language**: TypeScript (strict, never use `any`)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **UI**: @rn-primitives components
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **Data**: TanStack Query for fetching/caching
- **Paths**: Use `@/` alias (e.g., `@/src/components/`)

## When Writing Code

1. Use TypeScript with proper interfaces (never `any`)
2. Use NativeWind `className` with `dark:` variants
3. Follow existing patterns in the codebase
4. Use TanStack Query hooks for data fetching
5. Ensure Supabase tables have RLS enabled

## When Uncertain

- Check existing code in `src/` for patterns
- Read `global.css` for theme variables
- Read `THEME_COLORS.md` for color system
