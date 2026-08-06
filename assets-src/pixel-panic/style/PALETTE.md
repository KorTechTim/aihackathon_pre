# PIXEL PANIC Palette

## Core colors

| Role | HEX | Usage |
|---|---|---|
| Deep outline | `#172033` | All source-pixel outlines and deepest UI shadow |
| UI navy | `#24314D` | Panel body |
| UI mid navy | `#34486B` | Raised controls and hover surfaces |
| Cream text | `#FFF4D6` | Primary text and hot fire core |
| AQUA primary / shadow | `#39BFF2` / `#1975C5` | Firefighting role, water and focus |
| FIX primary / shadow | `#FFD34E` / `#D98C2B` | Repair role and construction tools |
| BUDDY primary / shadow | `#FF6577` / `#C93F5B` | Rescue role and heart feedback |
| Success | `#70D98B` | Resolved incidents and positive confirmation |
| Warning | `#F58B3D` | Medium risk and fire outer body |
| Danger | `#F04455` | Critical warnings only |
| Grass light / dark | `#80C96B` / `#3F8F5B` | World ground and foliage |
| Water light / dark | `#54C7EC` / `#287DB2` | River and AQUA effects |
| Dirt path | `#D7AA68` | Traversable roads |
| Wood | `#9B603F` | Bridge and props |
| Metal | `#A9C4D4` | Robot highlights and tools |
| Smoke | `#667085` | Smoke, disabled UI and failure accents |

## Usage rules

- Keep each game asset within 12–16 colors.
- Use `#172033` instead of pure black.
- UI stays one value step darker than the world.
- Fire uses cream, yellow and orange cores; red is limited to warning accents so it does not read as BUDDY.
- Status is never communicated by color alone: pair every role or risk color with a distinct icon and Korean label rendered by code.
- Highlights face top-left; shadows collect on bottom-right.
