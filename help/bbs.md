category: BBS
# +BBS

The Bulletin Board System for reading and posting announcements, IC news, and discussion.

## Reading

| Command | Description |
|---------|-------------|
| `+bbread` | List all boards |
| `+bbread <#>` | List posts on a board |
| `+bbread <#>/<#>` | Read a specific post |
| `+bbscan` | Show all unread postings |
| `+bbnew <#>` | List unread messages in a board |
| `+bbnext` | Read the next unread message |
| `+bbnext <#>` | Read the next unread message in a board |
| `+bbsearch <#>/<name>` | Search a board for posts by a player |

## Posting

| Command | Description |
|---------|-------------|
| `+bbpost <#>/<title>` | Start a new post to a board |
| `+bbpost <#>/<subject>=<body>` | Quick-post a message in one command |
| `+bb <text>` | Add text to your post in progress |
| `+bbedit text=<old>/<new>` | Edit your post in progress |
| `+bbedit title=<old>/<new>` | Edit the title of your post in progress |
| `+bbproof` | Preview your post in progress |
| `+bbtoss` | Discard your post in progress |
| `+bbpost` | Submit your finished post |

## Replies

| Command | Description |
|---------|-------------|
| `+bbreply <#>/<#>` | Start a threaded reply to a post |
| `+bbreply <#>/<#>=<body>` | Quick-reply in one command |

## Editing & Removing

| Command | Description |
|---------|-------------|
| `+bbedit <#>/<#>=<old>/<new>` | Edit one of your posted messages |
| `+bbremove <#>/<list>` | Remove your post(s). List can be a number, range (1-3), or comma-separated |
| `+bbmove <#>/<#> to <#>` | Move one of your posts to another board |

## Catchup & Subscription

| Command | Description |
|---------|-------------|
| `+bbcatchup <#>` | Mark a board as read |
| `+bbcatchup all` | Mark all boards as read |
| `+bbleave <#>` | Unsubscribe from a board |
| `+bbjoin <#>` | Rejoin a board you left |
| `+bblist` | List all boards with timeout values |
| `+bbnotify <#>=<on/off>` | Toggle post notifications for a board |
| `+bbsig [text]` | Set your BBS signature |
| `+bbsig /clear` | Clear your BBS signature |

You can use a board's name (or abbreviation) in place of its number.

For more detail: `+bbhelp bbread`, `+bbhelp bbpost`, `+bbhelp bbmisc`
