# Modified BBS for UrsaMU

A Myrddin-style Bulletin Board System plugin for [UrsaMU](https://github.com/UrsaMU/ursamu). Ported from Evennia's BBS implementation with full feature parity.

## Features

- **28 commands** — complete player and staff command set
- **Threading** — reply to posts with nested replies (`+bbreply`)
- **Drafts** — multi-step compose with proof/edit/toss workflow
- **Signatures** — auto-appended to posts and replies
- **Read tracking** — per-player unread tracking with `+bbscan`, `+bbnew`, `+bbnext`
- **Board permissions** — read and write locks per board
- **Notifications** — broadcast to subscribers on new posts
- **Post expiration** — automatic cleanup of old posts
- **Search** — find posts by author
- **Subscription management** — leave/join/notify per board

## Installation

1. Copy the plugin files into `src/plugins/bboards/` in your UrsaMU project
2. Restart the server
3. Create boards with `+bbnewgroup <title>`

## Player Commands

| Command | Description |
|---------|-------------|
| `+bbread` | Scan all boards |
| `+bbread <#>` | List posts on a board |
| `+bbread <#>/<#>` | Read a specific post |
| `+bbread <#>/<#>*` | Read post with all replies |
| `+bbread <#>/u` | Read all unread on a board |
| `+bbread <#>/1-5` | Read a range of posts |
| `+bbnew <#>` | List unread messages on a board |
| `+bbnext [#]` | Read next unread message |
| `+bbscan` | Compact unread count per board |
| `+bbcatchup <#> \| all` | Mark messages as read |
| `+bbpost <#>/<subject>` | Start a draft |
| `+bbpost <#>/<subject>=<body>` | Quick post |
| `+bb <text>` | Append text to draft |
| `+bbproof` | Preview draft |
| `+bbtoss` | Discard draft |
| `+bbpost` | Submit draft |
| `+bbreply <#>/<#>` | Start a reply draft |
| `+bbreply <#>/<#>=<text>` | Quick reply |
| `+bbremove <#>/<list>` | Delete your posts |
| `+bbmove <#>/<#> to <#>` | Move post to another board |
| `+bblist` | Show all boards with details |
| `+bbleave <#>` | Unsubscribe from board |
| `+bbjoin <#>` | Rejoin board |
| `+bbnotify <#>=on\|off` | Toggle notifications |
| `+bbsearch <#>/<name>` | Find posts by author |
| `+bbsig [text]` | Set signature |
| `+bbsig /clear` | Clear signature |
| `+bbedit` | Edit draft or live post |
| `+bbhelp [topic]` | BBS help system |

## Staff Commands

| Command | Description |
|---------|-------------|
| `+bbnewgroup <title>` | Create a new board |
| `+bbcleargroup <#>` | Mark board for deletion |
| `+bbconfirm <#>` | Confirm board deletion |
| `+bblock <#>=<lock>` | Set read lock |
| `+bbwritelock <#>=<lock>` | Set write lock |
| `+bbtimeout <#>/<#>=<days>` | Set post expiration |
| `+bbconfig [setting=value]` | View/set BBS configuration |

## Configuration

- `+bbconfig timeout=<days>` — global default post timeout
- `+bbconfig autotimeout=on|off` — enable automatic post expiration
- `+bbconfig <#>/timeout=<days>` — per-board timeout
- `+bbconfig <#>/anonymous=on|off` — hide author names

## Lock System

Boards support read and write locks:
- `all()` — no restriction (default)
- `superuser` — superuser only
- Any valid UrsaMU lock expression

## Requirements

- UrsaMU v1.3+ with the DBO database system
- Deno runtime

## Credits

Inspired by Myrddin's BBS for MUSHes. Ported from an Evennia implementation.

## License

MIT
