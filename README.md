# Roadtrip Games

Score **Flocks**, **Zombie Flocks**, **Volvo trucks** and the **license plate game** on an iPad in the car, see where everything was spotted on a map afterwards, and keep every trip forever: all-time stats for each player, a trip history, and awards to earn along the way.

It's one small program that runs at home (on a Windows PC, a Mac, a Raspberry Pi, or in Docker). The iPad opens it in Safari. The iPad keeps everything itself while you play and sends it home whenever it can reach the home server: on your Wi-Fi, or from the car over cell with WireGuard. A dead zone never loses anything.

> This is a hobby project, **developed with AI** (Claude, by Anthropic). Use it at your own risk; there's no warranty. Licensed under GPL-3.0.

## The games

Up to four players. The switch at the top of the screen flips between the **Competitive** games and the **Together** game.

### Competitive

**Flocks.** Count the livestock you see: cows, horses, sheep, goats, chickens, llamas & alpacas, and pigs. Tap the animal, then tap how many.
- **Cemetery:** the player who spots one taps **Cemetery** on their own panel and picks whose flocks die (everyone else is ticked to start with). Those flocks drop to zero.
- **Church:** the player who spots one taps **Church** on their own panel and gets back everything they lost to cemeteries since their last church.
- When you end the trip, the biggest flock wins.

**Zombies.** Roadkill makes up your zombie flock: deer, rabbits, squirrels, foxes, raccoons and opossums. One tap counts one. Cemeteries and churches don't touch zombies. The biggest zombie flock wins the trip.

**Volvos.** Tap the colour of the Volvo truck you spotted, then choose either "Volvo truck white" (1 point) or, with VOLVO on the cab fairing, "Volvo truck white Volvo" (double, 2 points). The most points wins the trip.

Each panel's **Undo** takes back that player's last tap in that game.

### Together

**License plates.** The whole car plays as a team. Tap a state or province the moment anyone sees it. Tap a found plate to take it back.

## The map

When the iPad is on the home server's secure address (see below), every sighting is saved with where it happened. The **Map** tab shows each trip on an OpenStreetMap map, with a pin for every cow count, cemetery, church, zombie, Volvo and plate, coloured by player. Tap a pin to see who, what and when. Viewing the map needs an internet connection for the map pictures; recording locations doesn't.

## Stats and awards

**Stats** shows each player's all-time totals for every game (animals by kind, flocks killed, flocks lost, churches, animals brought back, zombies by kind, Volvos by colour), the plates your car has seen over every trip, and a list of past trips with each game's winner.

**Awards** shows every award, earned or not, with when and on which trip. A pop-up announces each one the moment it's earned. There are 37, including Shepherd, Big Herd, Grim Reaper, Heartbreak, Hallelujah, Miracle, Comeback Kid, Zombie Zoo, Zombie Apocalypse, Say It Twice, Rainbow Fleet, Coast to Coast and Fifty Club.

## Setting it up at home (Windows)

1. Download `roadtrip-games-windows.zip` from the latest build (the **Actions** tab, newest "build" run, **Artifacts**) or from the [Releases page](https://github.com/jsttylr/Flocks_and_other_roadtrip_games/releases) once there is one. Right-click it, choose **Extract All**, and put the folder somewhere permanent, for example `C:\RoadtripGames\`.
2. Double-click `roadtrip-games.exe`. If Windows says "Windows protected your PC", click **More info**, then **Run anyway**.
3. When Windows Firewall asks, tick **Private networks** and click **Allow**.
4. Your browser opens the page. There is no program window; it keeps running in the background. Your history is kept in the `data` folder next to the program.

## Setting up the iPad (once)

1. With the iPad on your home Wi-Fi, open Safari and go to `http://<the PC's address>:8070`, for example `http://192.168.1.50:8070`. (On Windows, `ipconfig` in Command Prompt shows the PC's "IPv4 Address".)
2. Open **Trips & players**. The **Turn on locations for the map** card walks you through it:
   - Tap **Download the home certificate**, then **Allow**.
   - In **Settings**, tap **Profile Downloaded**, then **Install**.
   - In **Settings, General, About, Certificate Trust Settings**, switch on **Roadtrip Games at home**.
   - Open the secure address it lists (`https://192.168.1.50:8443`), allow location when asked, and add it to the home screen (Share, **Add to Home Screen**). Use that icon from now on.
3. Add the players and start a trip.

Why the certificate: Safari only gives a page the iPad's GPS when the page is on a secure (https) address. The program makes its own certificate the first time it runs, just for your home server; the iPad is told to trust it once. As a bonus, the secure address lets the iPad keep a copy of the page, so it opens even with no signal.

For the car, keep WireGuard on so the iPad can reach home over cell. If the address you use over WireGuard isn't one the program knows about (it shows its addresses when it starts, and on the Trips & players card), add it with `-hosts`, for example `roadtrip-games.exe -hosts 10.6.0.1`. Only the plain and secure addresses keep separate copies on the iPad, so switch from one to the other only when the top of the page says **Saved at home**.

## Running it with Docker

GitHub builds a container on every change and stores it at `ghcr.io/jsttylr/flocks_and_other_roadtrip_games`. Since this repository is private, the container is private too, so the Docker machine needs to log in to GitHub's registry once (`docker login ghcr.io`, with your GitHub username and a personal access token that has the `read:packages` permission).

Edit `ROADTRIP_HOSTS` in `docker-compose.yml` to the address the iPad uses to reach the Docker machine (the container can't see it by itself), then:

```sh
docker compose up -d
```

## Backups

**Trips & players**, then **Download a backup**, saves the whole history as one file. On the home computer it's the file `data/events.jsonl`; copying that file is also a full backup. Keep `data/ca.crt` and `data/ca.key` too, or the iPad will need to trust a new certificate.

## For the curious

Every tap is saved as a small "event" (a cow counted, a cemetery called, a plate found). The iPad keeps them and sends them home; the server keeps every one in `events.jsonl` and never changes or deletes them. Scores, stats and awards are all worked out from that list, so stats or awards added later also count everything you've already played, and undo simply records "ignore that one".

Options: `-port 8070` (plain address), `-https-port 8443` (secure address, `0` turns it off), `-hosts a,b` (extra names or addresses for the secure address), `-data <folder>`, and `-no-browser`. In Docker: `ROADTRIP_PORT`, `ROADTRIP_HTTPS_PORT`, `ROADTRIP_HOSTS`, `ROADTRIP_DATA`.

To check changes: `go test ./...` and `node --test 'tests/*.test.js'`.
