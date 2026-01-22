# DoKoHub

<p align="center">
  <img src="src/lib/assets/dokohub.png" alt="DoKoHub Logo" width="50%">
</p>

A web-based scorecard and game management application for tracking **Doppelkopf** card game sessions with groups of players.

## Use Case

DoKoHub is designed for groups of friends or regular card game players who want to:
- **Track games** across multiple sessions with consistent groups
- **Manage players** and their memberships in different groups
- **Record game statistics** including rounds, scores, team assignments, and special events (calls, bonuses)
- **Analyze performance** with visual statistics and cumulative scoring charts
- **Invite players** to join groups and participate in games
- **OAuth2 based Authentication** via Google

## Ruleset
Developed based on the official "Tunierspielregeln" (tournament rules) of the "German Doppelkopf-Verband e. V."

## Features

### Group & Player Management
- **Create and manage groups** with multiple players
- **Player types**:
  - **Local players**: Created directly in groups for casual play, no authentication required
  - **Non-local players**: OAuth-authenticated players that can be invited and manage multiple groups
- **Invite system** for adding non-local players to groups via link or QR code

### Game Management
- **Create games** with configurable rules:
  - Customizable number of rounds
  - Mandatory solo rounds (Pflicht-Solo) mode
  - Support for both 4-player and 5-player games (dealer sits out in 5-player format)
- **Track rounds** with full details:
  - Round types: Normal, Hochzeit (wedding), Stille Hochzeit (silent wedding)
  - Solo variants (Kreuz, Pik, Herz, Karo)
  - Team assignments (Re vs. Kontra)
  - Player calls and announcements (Re, Kontra, various Absagen)
  - Bonuses: Fuchs, Doppelkopf, Karlchen
  - Point calculations with automatic result determination

### Statistics & Analytics
- Point accumulation charts showing cumulative scores per player across rounds
- Team distribution (Re vs. Kontra participation)
- Win/loss records per player
- Performance metrics across multiple games

## Development Setup

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup instructions, available commands, and development guidelines.
