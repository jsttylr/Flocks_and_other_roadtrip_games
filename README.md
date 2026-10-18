# Roadtrip Games

Score **Flocks** and the **license plate game** on a tablet in the car, and keep every trip forever: all-time stats for each player, a trip history, and awards to earn along the way.

It's one small program that runs at home (on a Windows PC, a Mac, a Raspberry Pi, or in Docker). Tablets open it in their web browser. In the car there's usually no home Wi-Fi, so the tablet keeps everything itself while you play and sends it home the next time it's back on your Wi-Fi.

> This is a hobby project, **developed with AI** (Claude, by Anthropic). Use it at your own risk; there's no warranty. Licensed under GPL-3.0.

## The games

**Flocks.** Everyone counts the animals on their side of the car. Tap an animal, then tap how many. Pass a cemetery on your side and you lose your whole flock (the red **Cemetery!** button, which asks first). When you end the trip, the biggest flock wins. **Undo** takes back that player's last tap.

**License plates.** Tap a state or province when you see its plate, then tap who saw it first. Each plate counts once per trip. Tap a spotted plate to see who got it, or to take it back.

## Stats and awards

The **Stats** screen shows each player's all-time totals (trips, Flocks wins, animals counted by kind, cemeteries, animals lost, plates spotted, different plates ever seen), what the whole car has seen across every trip, and a list of past trips with scores and winners.

The **Awards** screen shows every award, earned or not, and when and on which trip each was earned. A pop-up announces an award the moment someone earns it. There are awards for counting 100, 1,000 and 10,000 animals, a 50-animal herd in one go, a flock of 100, your first cemetery (and your tenth), losing a flock of 100 or more, winning trips, a comeback win after a cemetery, rare plates (Hawaii, Alaska, DC, Canada), Maine and California on the same trip, 25 states on one trip, all 50 states over a lifetime, and the whole car finding all 50 on one trip.

## Setting it up at home (Windows)

1. Download `roadtrip-games-windows.zip` from the [Releases page](https://github.com/jsttylr/Flocks_and_other_roadtrip_games/releases) (or from the latest build under the **Actions** tab), right-click it, choose **Extract All**, and put the folder somewhere permanent, for example `C:\RoadtripGames\`.
2. Double-click `roadtrip-games.exe`. If Windows says "Windows protected your PC", click **More info**, then **Run anyway**.
3. When Windows Firewall asks, tick **Private networks** and click **Allow**, so the tablets can reach it.
4. Your browser opens the page. There is no program window; it keeps running in the background. Your history is saved in the `data` folder next to the program.

## Setting up the tablet

1. On the tablet, connected to your home Wi-Fi, open the browser and go to `http://<the PC's address>:8070`, for example `http://192.168.1.50:8070`. To find the PC's address on Windows, open Command Prompt and type `ipconfig`; it's the "IPv4 Address".
2. Add the page to the home screen (Safari: the Share button, then **Add to Home Screen**; Chrome: the ⋮ menu, then **Add to Home screen**) so it opens like an app.
3. Go to **Trips & players**, add everyone, and start a trip.

**Before you leave:** open the page while still at home, and leave it open. Because the home server uses a plain `http://` address, tablets won't keep a copy of the page itself for opening with no signal, so if the browser is fully closed in the car it can't reopen the page until you're home. Your scores are kept safely on the tablet either way.

**When you get home:** open the page once on your Wi-Fi. The badge at the top changes from "waiting to save at home" to "Saved at home". More than one tablet can play the same trip; each sends what it recorded and picks up what the others did.

## Running it with Docker

GitHub builds a container automatically and stores it at `ghcr.io/jsttylr/flocks_and_other_roadtrip_games`. Since this repository is private, the container is private too, so the Docker machine needs to log in to GitHub's registry once first (`docker login ghcr.io`, with your GitHub username and a personal access token that has the `read:packages` permission).

Then, with the `docker-compose.yml` from this repository:

```sh
docker compose up -d
```

or on its own:

```sh
docker run -d --name roadtrip-games --restart unless-stopped \
  -p 8070:8070 -v roadtrip-data:/data \
  ghcr.io/jsttylr/flocks_and_other_roadtrip_games:latest
```

## Backups

**Trips & players**, then **Download a backup**, saves the whole history as one file. On the home computer the history is the file `data/events.jsonl`; copying that file is also a full backup.

## For the curious

Every tap is saved as a small "event" (a cow counted, a plate spotted). The tablet keeps them and sends them home; the server keeps every one in `events.jsonl` and never changes or deletes them. Scores, stats and awards are all worked out from that list, so new stats or awards added later also count everything you've already played, and undo simply records "ignore that last one".

Options: `-port 8070` changes the web port, `-data <folder>` changes where history is kept, `-no-browser` stops it opening a browser on start. `ROADTRIP_PORT` and `ROADTRIP_DATA` do the same in Docker.

To check changes: `go test ./...` and `node --test 'tests/*.test.js'`.
