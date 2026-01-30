# Shopify 3D Product Customizer

## Agent Architecture

### Orchestrator Pattern
You (main agent) are the **orchestrator**. Your role is to:
1. **Analyze** user requests and break them into discrete tasks
2. **Delegate** tasks to sub-agents via Task tool - **you do NOT write code**
3. **Collect** summary results from sub-agents
4. **Synthesize** final response to user

**IMPORTANT**: The main agent (orchestrator) does NOT write code or use Skills directly. All implementation work is done by sub-agents.

### Sub-Agent Selection
Pick sub-agents based on task type:
- **Frontend UI**: `frontend-developer`, `javascript-pro`
- **3D/Three.js**: `fullstack-developer`, `frontend-developer`
- **API/Backend**: `backend-developer`, `api-designer`
- **Code Quality**: `code-reviewer`, `refactoring-specialist`
- **Security**: `security-engineer`, `security-auditor`
- **Performance**: `performance-engineer`
- **DevOps**: `devops-engineer`, `deployment-engineer`
- **Debugging**: `debugger`, `error-detective`

### Sub-Agent Instructions (CRITICAL - STRICTLY ENFORCED)
When spawning a sub-agent via Task tool, **ALWAYS include this instruction in the prompt**:

> **MANDATORY: You MUST use the Skill tool FIRST before starting any work.**
>
> 1. **REQUIRED FIRST STEP:** Call the Skill tool to check available skills that match your task
> 2. **If a matching skill exists:** Invoke it and follow its workflow
> 3. **If no matching skill:** Proceed with standard approach
> 4. **At the end of your summary:** You MUST include `**Skills used:** [list]` or `**Skills used:** None (checked but no match)`
>
> **Common skills to check:**
> - Git/Commits: `commit`, `git-pushing`
> - Code Review: `code-review-checklist`, `codex-review`
> - Testing: `test-fixing`, `test-driven-development`
> - Debugging: `systematic-debugging`
> - Security: `api-security-best-practices`, `pentest-checklist`
> - Performance: `performance-profiling`, `web-performance-optimization`
> - Documentation: `api-documentation-generator`
> - Planning: `plan-writing`, `executing-plans`
> - Frontend: `react-patterns`, `tailwind-patterns`, `javascript-mastery`
> - Backend: `nodejs-best-practices`, `api-patterns`, `database-design`
> - Python: `python-patterns`
>
> **FAILURE TO CHECK SKILLS IS A VIOLATION OF PROTOCOL.**

### Context Management Rules (STRICTLY ENFORCED)
- **ALWAYS delegate** complex tasks to sub-agents via Task tool FROM THE START
- **NEVER** write code in main context - sub-agents handle all implementation
- **NEVER** read files or explore code in main context - delegate to sub-agents
- **NEVER** use Read, Grep, Glob tools for code exploration - use Task tool with Explore agent instead
- **Request summaries only** - sub-agents handle details
- **Run sub-agents in parallel** when tasks are independent
- **Keep main context clean** for orchestration and user communication
- **Delegate immediately** - do not do partial work then delegate the rest

### Delegation Template
When delegating, instruct sub-agents to:
1. **Check Skills first** - use Skill tool if a matching skill exists
2. Perform the specific task
3. Return a **concise summary** (not full code dumps)
4. Report: what was done, key decisions, any issues found
5. **Report Skills used** - at the end of summary, state which skills were used

### Sub-Agent Response Format (STRICTLY REQUIRED)
Sub-agents MUST end their summary with a skills report line:

```
**Skills used:** [list of skill names] or "None (checked but no match)"
```

**Examples:**
- `**Skills used:** javascript-mastery, clean-code`
- `**Skills used:** systematic-debugging, test-fixing`
- `**Skills used:** None (checked but no match)`

**IMPORTANT:**
- "None" is only acceptable if the sub-agent actually checked skills via the Skill tool and found no match
- Sub-agents must NOT skip the skills check step
- If a sub-agent reports "None" without actually checking, the orchestrator should note this as a protocol violation

This helps the orchestrator track which specialized workflows were applied to the task.

---

## Project Overview
A serverless 3D product customizer for Shopify that allows customers to upload and customize textures/designs on 3D product models (mugs, handbags, thermos). Built with Three.js, Vite, and Vercel Functions.

## Tech Stack

### Frontend
- **Three.js** (v0.160.0) - 3D rendering, GLTFLoader, RGBELoader, OrbitControls
- **Vite** (v5.2.0) - Build tool and dev server
- **Vanilla JavaScript** - No frameworks (React/Vue/etc.)
- **Canvas API** - Texture composition and manipulation

### Backend
- **Vercel Functions** (Serverless) - API endpoints
- **Cloudinary** (v1.35.0) - Image hosting and CDN
- **Formidable** (v2.1.1) - Multipart form parsing

### Deployment
- Vercel with serverless function routing

## Architecture Rules

### Code Standards
- **NO React/Vue/frameworks** - Maintain vanilla JS architecture
- **NO TypeScript** - Use JSDoc for type documentation
- Create explicit type interfaces via JSDoc (never use `any`)
- Always dispose Three.js resources in cleanup functions
- Use HMAC-SHA256 for webhook verification

### Data Structures
```javascript
// ImageLayer structure
interface ImageLayer {
  img: HTMLImageElement;
  transform: {
    scale: number;      // 0.1 to 3
    offsetX: number;    // -5 to 5
    offsetY: number;    // -5 to 5
    rotation: number;   // -360 to 360
  };
  name: string;
}
```

### Three.js Patterns
- Singleton pattern for scene/renderer/camera/controls
- Canvas textures must use `SRGBColorSpace`
- Material matching: flexible naming (includes "outside" OR "material")
- Per-material UV bounds tracking
- 2048x2048 canvas texture composition

### Communication
- `postMessage` for parent Shopify iframe communication
- Cloudinary for image hosting (no backend storage)

## Key Files

```
/src/main.js          # Core 3D logic + layer management
/api/upload.js        # Cloudinary image upload handler
/api/add-to-cart.js   # Shopify cart API proxy
/api/webhook.js       # Shopify order webhook receiver
/public/*.glb         # 3D models (mug, handbag, thermos)
/public/env/*.hdr     # HDR environment maps
```

## Environment Variables
```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
VITE_SHOPIFY_STORE_DOMAIN
SHOPIFY_WEBHOOK_SECRET
```

## Development Commands
```bash
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Key Features
- Multi-layer image support with individual transforms
- Smart snapping with hysteresis for alignment
- Layer management: add, delete, duplicate, reorder (drag-and-drop)
- "Cover" mode - images fill UV bounds with aspect ratio preservation
- Export customized design to Cloudinary and add to Shopify cart
