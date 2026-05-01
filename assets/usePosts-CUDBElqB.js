import{B as e,K as t,Y as n}from"./index-CTaccbH0.js";var r=e();function i({style:e={}}){return(0,r.jsx)(`div`,{style:{background:`linear-gradient(90deg, #1A1A1A 25%, #222 50%, #1A1A1A 75%)`,backgroundSize:`200% 100%`,animation:`shimmer 1.5s infinite`,borderRadius:`6px`,...e}})}function a(){return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(`style`,{children:`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}),(0,r.jsxs)(`div`,{style:{padding:`1.5rem 0`,borderBottom:`1px solid #1A1A1A`},children:[(0,r.jsx)(i,{style:{height:`14px`,width:`80px`,marginBottom:`0.75rem`}}),(0,r.jsx)(i,{style:{height:`22px`,width:`70%`,marginBottom:`0.5rem`}}),(0,r.jsx)(i,{style:{height:`16px`,width:`90%`,marginBottom:`0.25rem`}}),(0,r.jsx)(i,{style:{height:`16px`,width:`60%`,marginBottom:`1rem`}}),(0,r.jsx)(i,{style:{height:`12px`,width:`120px`}})]})]})}var o=n(t(),1),s=`---
title: "Building Production-Ready Bots with Python"
slug: "building-bots-with-python"
date: "2024-03-15"
excerpt: "A deep dive into building scalable, maintainable bots using Python — covering async patterns, persistence, rate limiting, and deployment strategies."
tags: ["Python", "Automation", "Bots"]
author: "Suay"
---

# Building Production-Ready Bots with Python

Bots are deceptively simple on the surface — a few API calls, some logic, done. But production bots are a different beast entirely. They need to handle rate limits, reconnect gracefully, persist state, and survive crashes at 3am when you're not watching.

This is what I've learned from building bots that actually run reliably in production.

## Start with Async

The single most important architectural decision is going async from day one. Synchronous bots are a trap — they look fine until you're handling 50 concurrent users and everything grinds to a halt.

\`\`\`python
import asyncio
import aiohttp

async def fetch_data(session: aiohttp.ClientSession, url: str) -> dict:
    async with session.get(url) as response:
        response.raise_for_status()
        return await response.json()

async def process_batch(urls: list[str]) -> list[dict]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_data(session, url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out exceptions
    return [r for r in results if not isinstance(r, Exception)]
\`\`\`

\`asyncio.gather\` with \`return_exceptions=True\` is your friend. It prevents one failing request from killing your entire batch.

## Rate Limiting That Actually Works

Every public API has rate limits. Most bots I've seen handle this wrong — they either sleep blindly or hammer the API until they get 429s.

The right approach is a token bucket:

\`\`\`python
import asyncio
import time

class RateLimiter:
    def __init__(self, rate: int, per: float = 1.0):
        self.rate = rate
        self.per = per
        self._tokens = rate
        self._last_check = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_check
            self._last_check = now
            self._tokens = min(
                self.rate,
                self._tokens + elapsed * (self.rate / self.per)
            )
            if self._tokens < 1:
                wait = (1 - self._tokens) * (self.per / self.rate)
                await asyncio.sleep(wait)
                self._tokens = 0
            else:
                self._tokens -= 1
\`\`\`

## Persistence: SQLite First, Scale Later

Unless you're at serious scale, SQLite with \`aiosqlite\` covers 95% of bot persistence needs. It's fast, requires zero infrastructure, and the whole database is a single file you can back up with \`cp\`.

\`\`\`python
import aiosqlite

async def init_db(path: str = "bot.db"):
    async with aiosqlite.connect(path) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                joined   REAL    NOT NULL DEFAULT (unixepoch()),
                data     TEXT    DEFAULT '{}'
            )
        """)
        await db.commit()
\`\`\`

When you actually need to scale, migrate to PostgreSQL. But don't pre-optimize.

## Graceful Shutdown

This is what separates amateur bots from production bots. You need to handle \`SIGTERM\` properly:

\`\`\`python
import signal
import asyncio

async def main():
    bot = MyBot()
    
    loop = asyncio.get_event_loop()
    
    def shutdown(sig):
        print(f"Received {sig.name}, shutting down...")
        loop.create_task(bot.close())
    
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown, sig)
    
    await bot.start()

asyncio.run(main())
\`\`\`

## The Checklist

Before deploying any bot to production, verify:

- **Reconnect logic** — What happens when the API disconnects? Exponential backoff, not tight loops.
- **Error logging** — Every exception should be logged with context. Use \`structlog\` or at minimum the \`logging\` module properly.
- **Health checks** — A \`/health\` endpoint or a watchdog that restarts dead processes.
- **Secrets management** — Never hardcode tokens. \`.env\` files locally, environment variables in production.
- **Idempotency** — If the bot processes the same event twice, does anything break?

Production bots aren't complicated. They're just careful.
`,c=`---
title: "Developer Tooling: Automating Your Own Workflow"
slug: "dev-tools-automation"
date: "2024-02-08"
excerpt: "The tools you build for yourself are the best ones. Here's how I approach building personal dev tooling that actually sticks and saves real time."
tags: ["Tooling", "Automation", "CLI"]
author: "Suay"
---

# Developer Tooling: Automating Your Own Workflow

The best developer tool is the one you built yourself. Not because it's technically superior — it's usually not — but because it fits your exact mental model of how work gets done.

I've built dozens of personal tools over the years. Most were abandoned within a week. A handful became indispensable. Here's what separates them.

## The Rule: Automate the Third Time

Don't automate something the first time you do it. Don't even think about it the second time. But the third time you perform the same sequence of keystrokes? Stop and write a script.

This rule prevents premature abstraction while ensuring you actually understand what you're automating before you codify it.

## CLI Tools with Click

For anything beyond a simple script, \`click\` is the right foundation:

\`\`\`python
import click
import subprocess
from pathlib import Path

@click.group()
@click.version_option()
def cli():
    """Personal dev toolkit."""
    pass

@cli.command()
@click.argument("project", type=click.Path())
@click.option("--template", "-t", default="python", 
              type=click.Choice(["python", "node", "rust"]),
              help="Project template to use.")
@click.option("--git/--no-git", default=True, help="Initialize git repository.")
def new(project: str, template: str, git: bool):
    """Scaffold a new project."""
    path = Path(project)
    
    if path.exists():
        click.echo(click.style(f"Error: {project} already exists.", fg="red"), err=True)
        raise SystemExit(1)
    
    path.mkdir(parents=True)
    _apply_template(path, template)
    
    if git:
        subprocess.run(["git", "init", str(path)], check=True, capture_output=True)
        click.echo(click.style("✓ Git initialized", fg="green"))
    
    click.echo(f"Created {click.style(project, fg='cyan')} ({template})")

def _apply_template(path: Path, template: str):
    templates = {
        "python": _python_template,
        "node": _node_template,
    }
    templates.get(template, lambda p: None)(path)

def _python_template(path: Path):
    (path / "src").mkdir()
    (path / "src" / "__init__.py").touch()
    (path / "pyproject.toml").write_text('[project]\\nname = ""\\nversion = "0.1.0"\\n')
    (path / ".gitignore").write_text("__pycache__/\\n*.pyc\\n.venv/\\ndist/\\n")
    (path / "README.md").write_text(f"# {path.name}\\n")

if __name__ == "__main__":
    cli()
\`\`\`

## Shell Aliases That Actually Help

Your shell config is the first tool you should optimize. A few patterns that pay dividends:

\`\`\`bash
# Project jumping with fuzzy finding
function p() {
  local dir
  dir=$(find ~/projects -maxdepth 2 -type d | fzf --query="$1" --select-1 --exit-0)
  [ -n "$dir" ] && cd "$dir"
}

# Git shortcuts
alias gs="git status -sb"
alias ga="git add -p"          # Staged patches, forces you to review
alias gd="git diff --stat"

# Quick HTTP server in current dir
alias serve="python3 -m http.server 8000"

# Kill process on port
function killport() {
  lsof -ti ":$1" | xargs kill -9 2>/dev/null && echo "Killed :$1" || echo "Nothing on :$1"
}
\`\`\`

## What Makes a Tool Stick

Looking back at the tools I still use versus the ones I abandoned, the difference is almost always:

**Discoverability** — If I have to remember how to use it, I won't. \`--help\` output must be excellent. Self-documenting commands.

**Zero friction** — If a tool takes more than ~200ms to start, I'll avoid it. Fast startup matters. Don't import what you don't need.

**Composability** — Tools that work with pipes, that output parseable formats (JSON, TSV), that fit into existing workflows rather than replacing them.

**Error messages that help** — "Error: invalid input" is useless. "Error: expected ISO date (YYYY-MM-DD), got '12/03/24'" is helpful.

## The Meta-Tool: A Dev Journal

The highest-leverage tool I've built isn't a code generator or a scraper — it's a CLI that appends timestamped notes to a daily markdown file:

\`\`\`python
@cli.command()
@click.argument("note", nargs=-1, required=True)
def log(note: tuple[str, ...]):
    """Append a note to today's dev journal."""
    from datetime import date
    
    today = date.today().isoformat()
    journal_path = Path.home() / "notes" / f"{today}.md"
    journal_path.parent.mkdir(exist_ok=True)
    
    text = " ".join(note)
    timestamp = datetime.now().strftime("%H:%M")
    
    with journal_path.open("a") as f:
        if not journal_path.stat().st_size if journal_path.exists() else True:
            f.write(f"# {today}\\n\\n")
        f.write(f"- **{timestamp}** {text}\\n")
    
    click.echo(click.style("✓", fg="green") + f" Logged: {text}")
\`\`\`

Three weeks of using this and you have an invaluable record of what you actually worked on. It's become my alternative to stand-up notes, a debugging breadcrumb trail, and a way to context-switch without losing my train of thought.

Build tools that fit your brain. That's the whole secret.
`,l=`---
title: "Crafting the Perfect Arch Linux Setup"
slug: "linux-dotfiles-arch"
date: "2023-12-10"
excerpt: "My journey configuring Arch Linux from scratch — tiling window managers, dotfiles management with GNU Stow, and the philosophy of a minimal, reproducible system."
tags: ["Linux", "Dotfiles", "Arch"]
author: "Suay"
---

# Crafting the Perfect Arch Linux Setup

I've installed Arch Linux more times than I can count. Each time is a lesson in what matters and what doesn't. This is what I've settled on — a minimal, reproducible setup that gets out of the way and lets me work.

## The Philosophy

A development environment should be:

- **Reproducible** — I can go from blank machine to full setup in under 30 minutes
- **Minimal** — No tool I don't use, no config I don't understand
- **Fast** — Everything launches instantly, nothing blocks

The enemy of all three is bloat. KDE and GNOME are fine for many people. They're not for me.

## The Stack

\`\`\`
WM:       bspwm + sxhkd
Bar:      polybar
Terminal: alacritty
Shell:    zsh + starship
Editor:   neovim
Launcher: rofi
Fonts:    JetBrains Mono Nerd Font
\`\`\`

## Dotfiles with GNU Stow

The trick to manageable dotfiles is GNU Stow — a symlink farm manager that treats your dotfiles directory as a package collection:

\`\`\`
~/.dotfiles/
├── alacritty/
│   └── .config/
│       └── alacritty/
│           └── alacritty.toml
├── nvim/
│   └── .config/
│       └── nvim/
│           └── init.lua
└── zsh/
    ├── .zshrc
    └── .zprofile
\`\`\`

Install any package with:

\`\`\`bash
stow -d ~/.dotfiles -t ~ alacritty nvim zsh
\`\`\`

Stow creates symlinks from \`~/.config/alacritty/alacritty.toml\` to \`~/.dotfiles/alacritty/.config/alacritty/alacritty.toml\`. Your dotfiles live in one git repository, but appear in all the right places.

## The bspwm Config

bspwm is controlled entirely through a socket — the window manager itself has no concept of keybindings. That's sxhkd's job:

\`\`\`bash
# ~/.config/sxhkd/sxhkdrc

# Terminal
super + Return
    alacritty

# Launcher  
super + d
    rofi -show drun -theme ~/.config/rofi/launcher.rasi

# Window focus
super + {h,j,k,l}
    bspc node -f {west,south,north,east}

# Close window
super + q
    bspc node -c

# Layouts
super + {t,s,f}
    bspc node -t {tiled,floating,fullscreen}
\`\`\`

The separation of concerns is elegant: bspwm manages windows, sxhkd handles keys, polybar displays state. Each component is independently replaceable.

## The Bootstrap Script

The entire system is reproducible from a single script:

\`\`\`bash
#!/bin/bash
set -euo pipefail

PACKAGES=(
  base-devel git stow zsh neovim alacritty
  bspwm sxhkd polybar rofi picom
  fzf ripgrep fd bat eza zoxide
  ttf-jetbrains-mono-nerd
)

echo "Installing packages..."
sudo pacman -Syu --noconfirm "\${PACKAGES[@]}"

echo "Cloning dotfiles..."
git clone https://github.com/suayakbudak/arch.git ~/.dotfiles

echo "Stowing configs..."
cd ~/.dotfiles
for pkg in */; do
    stow -t ~ "\${pkg%/}"
done

echo "Setting shell..."
chsh -s "$(which zsh)"

echo "Done. Log out and back in."
\`\`\`

## What Actually Matters

I spent years tweaking my setup. Now I change almost nothing — the goal was always to get to a stable, fast environment and then stop thinking about it.

The best dotfiles are the ones you forget about.
`,u=`---
title: "Systems Thinking for Developers"
slug: "systems-thinking-for-devs"
date: "2024-01-22"
excerpt: "Good software is designed at the systems level before a single line of code is written. Here's how to think in systems and why it changes everything."
tags: ["Architecture", "Engineering", "Mindset"]
author: "Suay"
---

# Systems Thinking for Developers

The most important skill I've developed as a programmer isn't a language or a framework. It's the ability to model systems — to look at a problem and see the components, the flows, the feedback loops, and the failure modes before writing a single line of code.

## What Is a System?

A system is any set of things that interact. Your codebase is a system. An API you depend on is a system. Your database, your deployment pipeline, your team's review process — all systems.

Systems have properties that emerge from the interaction of parts, not from the parts themselves. A function that works perfectly in isolation can fail catastrophically in context. A team of brilliant individuals can produce mediocre software. These are systems failures.

## The Three Questions

Before building anything, I ask three questions:

**1. What changes, and at what rate?**

Requirements change. Data changes. User behavior changes. The question isn't *if* things will change but *what* will change and *how often*. Design for what's volatile. Stabilize what's stable.

\`\`\`
Stable: core business logic, data models (mostly)
Volatile: UI, API contracts, third-party integrations, configuration
\`\`\`

**2. Where are the failure modes?**

Every system fails. The question is: how? Gracefully or catastrophically? Visibly or silently?

Map your failure modes explicitly:
- What happens when the database is unreachable?
- What happens when an external API returns 500?
- What happens when data is malformed?
- What happens when two processes write simultaneously?

If you can't answer these questions before you build, you'll answer them in production.

**3. What are the feedback loops?**

Feedback loops are how systems self-regulate — or amplify instability. In software:

- A cache that gets invalidated too aggressively → stampede on the origin server
- A retry loop without backoff → DDoS yourself
- Tests that take 20 minutes → developers stop running them → more bugs → more debugging time

Identify your feedback loops. Fast, tight feedback loops are assets. Slow, loose ones are liabilities.

## Coupling and Cohesion

These are the oldest concepts in software design and still the most useful.

**Coupling** measures how much a change in one component forces changes in another. High coupling is fragility. When you change a database schema and fifteen files break, that's high coupling.

**Cohesion** measures how related the things inside a module are. High cohesion means everything in a module belongs together — it has one reason to change, one purpose.

The goal: **high cohesion, low coupling**. Every refactoring that's ever been meaningful in my career has been moving in this direction.

\`\`\`python
# Low cohesion: does too many unrelated things
class UserManager:
    def create_user(self): ...
    def send_welcome_email(self): ...
    def generate_pdf_report(self): ...
    def calculate_billing(self): ...

# High cohesion: one purpose
class UserRepository:
    def create(self, data: dict) -> User: ...
    def find_by_id(self, id: int) -> User | None: ...
    def update(self, user: User) -> User: ...
    def delete(self, id: int) -> None: ...
\`\`\`

## The Boundary Problem

The hardest design decisions aren't about algorithms — they're about where to draw boundaries. Where does one module end and another begin? Where does your service end and the next one start?

Boundaries should track natural seams in the problem domain. They should isolate change. A well-placed boundary means that when requirements change (and they will), the blast radius is contained.

Poorly placed boundaries cause pain that compounds. Every feature becomes a coordination problem. Every change ripples outward in unpredictable ways.

## Observe Before You Optimize

The most dangerous systems mistake is optimizing before you understand. A system you can't observe is a system you can't understand.

Instrument everything important. Not just errors — throughput, latency distributions, queue depths, cache hit rates. Build dashboards that answer the question: "Is the system healthy?"

Only then optimize. And only optimize the thing that's actually the bottleneck — because in a system, there is always exactly one bottleneck. Fix the wrong thing and your performance doesn't improve.

## The Practical Upshot

Systems thinking is a habit, not a technique. It's the practice of asking "and then what?" one more time than feels comfortable. It's drawing the diagram before writing the code. It's finding the failure modes in the design meeting, not the incident postmortem.

Most bugs aren't bugs — they're design decisions that didn't account for reality. Systems thinking is how you account for reality before it accounts for you.
`,d=200;function f(e){if(!e||typeof e!=`string`)return 1;let t=e.replace(/```[\s\S]*?```/g,``).trim().split(/\s+/).filter(Boolean).length;return Math.max(1,Math.ceil(t/d))}function p(e){if(!e||typeof e!=`string`)return{data:{},content:``};let t=e.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);if(!t)return{data:{},content:e};let[,n,r]=t,i={};return n.split(`
`).forEach(e=>{let t=e.indexOf(`:`);if(t===-1)return;let n=e.slice(0,t).trim(),r=e.slice(t+1).trim();(r.startsWith(`"`)&&r.endsWith(`"`)||r.startsWith(`'`)&&r.endsWith(`'`))&&(r=r.slice(1,-1)),r.startsWith(`[`)&&r.endsWith(`]`)&&(r=r.slice(1,-1).split(`,`).map(e=>e.trim().replace(/^['"]|['"]$/g,``)).filter(Boolean)),i[n]=r}),{data:i,content:r.trim()}}var m=Object.assign({"/content/posts/building-bots-with-python.md":s,"/content/posts/dev-tools-automation.md":c,"/content/posts/linux-dotfiles-arch.md":l,"/content/posts/systems-thinking-for-devs.md":u});function h(e,t){let{data:n,content:r}=p(e),i=t.split(`/`).pop().replace(`.md`,``),a=n.slug||i;return{slug:a,title:n.title||a.replace(/-/g,` `),date:n.date||``,excerpt:n.excerpt||r.replace(/^#+\s.*/m,``).trim().slice(0,160)+`...`,tags:Array.isArray(n.tags)?n.tags:n.tags?[n.tags]:[],author:n.author||`Suay`,readingTime:f(r),content:r,filePath:t}}var g=null;function _(){if(g)return g;let e=Object.entries(m).map(([e,t])=>{try{return h(t,e)}catch{return null}}).filter(Boolean).sort((e,t)=>e.date?t.date?new Date(t.date)-new Date(e.date):-1:1),t=new Set;return g=e.filter(e=>t.has(e.slug)?!1:(t.add(e.slug),!0)),g}function v(e){return _().find(t=>t.slug===e)||null}function y(){let e={};return _().forEach(t=>{t.tags.forEach(t=>{e[t]=(e[t]||0)+1})}),Object.entries(e).sort((e,t)=>t[1]-e[1]).map(([e,t])=>({tag:e,count:t}))}function b(){let[e,t]=(0,o.useState)([]),[n,r]=(0,o.useState)(!0),[i,a]=(0,o.useState)(null);return(0,o.useEffect)(()=>{try{t(_())}catch(e){a(e.message||`Failed to load posts`)}finally{r(!1)}},[]),{posts:e,loading:n,error:i}}function x(e){let[t,n]=(0,o.useState)(null),[r,i]=(0,o.useState)(!0),[a,s]=(0,o.useState)(null);return(0,o.useEffect)(()=>{if(!e){i(!1);return}try{let t=v(e);n(t),t||s(`Post not found`)}catch(e){s(e.message||`Failed to load post`)}finally{i(!1)}},[e]),{post:t,loading:r,error:a}}export{a as i,b as n,y as r,x as t};