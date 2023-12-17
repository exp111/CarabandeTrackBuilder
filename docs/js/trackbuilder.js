const trackArea = {
    x1: presetRect.x2, y1: presetRect.y1,
    x2: window.innerWidth, y2: window.innerHeight
};

class Tile {
    Type = "";
    Angle = 0;

    constructor(type, angle) {
        this.Type = type;
        this.Angle = angle;
    };
}

class Trackbuilder {
    Tracks = [{
        name: "Default",
        tiles: [
            new Tile("start", 270),
            new Tile("straight", 90),
            new Tile("curve", 180),
            new Tile("curve", 0),
            new Tile("curve", 180),
            new Tile("curve", 90),
            new Tile("straight", 90),
            new Tile("straight", 270),
            new Tile("curve", 0),
            new Tile("curve", 180),
            new Tile("straight", 90),
            new Tile("curve", 0),
            new Tile("curve", 270),
            new Tile("straight", 90),
        ]
    }, {
        name: "Jump",
        tiles: [
            new Tile("rampEnd", 270),
            new Tile("straight", 450),
            new Tile("curve", 270),
            new Tile("curve", 0),
            new Tile("start", 90),
            new Tile("curve", 90),
            new Tile("straight", 0),
            new Tile("curve", 270),
            new Tile("straight", 90),
            new Tile("curve", 180),
            new Tile("curve", 90),
            new Tile("ramp", 90),
        ]
    }];

    constructor(select) {
        for (let i in this.Tracks) {
            let track = this.Tracks[i];
            select.appendChild(new Option(track.name, track.name));
        }
    }

    onTrackSelect(name) {
        let track = this.Tracks.find(t => t.name == name);
        if (!track) {
            console.error(`No track with name ${name} found.`);
            return;
        }
        //TODO: reset beforehand?
        this.buildTrack(track);
    }

    buildTrack(track) {
        let usedTiles = [];
        let prevTile = null;
        let nextZone = null;
        for (let i in track.tiles) {
            let info = track.tiles[i];
            // get a matching tile
            let tile = Global.tiles.find(t => t.attrs.type == info.Type && !usedTiles.includes(t));
            if (tile == null) {
                console.error("not enough tiles.");
                return;
            }
            // place the tile
            tile.rotation(info.Angle);
            // first tile, place it at the center of the area
            if (prevTile == null) {
                tile.position({
                    x: trackArea.x1 + (trackArea.x2 - trackArea.x1) / 2,
                    y: trackArea.y1 + (trackArea.y2 - trackArea.y1) / 2
                });
                // get the zone that is on the right
                nextZone = tile.children[1];
                if (tile.children.length > 2) {
                    let other = tile.children[2];
                    if (nextZone.absolutePosition().x < other.absolutePosition().x) {
                        nextZone = other;
                    }
                }
            } else { // every tile after that, snap to the previous tile
                // get the right zone
                let zones = tile.children.filter(c => c.attrs.tag == "snapzone");
                let pos = tile.absolutePosition();
                // get the local offset of the previous snapzone
                let offset = Vector.diff(prevTile.absolutePosition(), nextZone.absolutePosition());
                // then add that onto our current pos to get the absolutepos where our next snapzone should be
                let nextZonePos = {
                    x: pos.x + offset.x,
                    y: pos.y + offset.y
                };
                // now find out which actual snapzone is closest to that point
                let ourZone = zones.sort((a, b) => Vector.dist(a.absolutePosition(), nextZonePos) - Vector.dist(b.absolutePosition(), nextZonePos))[0];
                moveGroupToSnapzone(tile, prevTile, ourZone, nextZone);
                // get the other snapzone for the next tile to snap to
                nextZone = zones.find(z => z != ourZone);
                if (nextZone == null) {
                    console.error("Dead end");
                    return;
                }
            }
            // add it to our list
            usedTiles.push(tile);
            prevTile = tile;
        }
    }

    serializeTrack() {
        let track = {name: "Track", tiles: []};
        let tiles = [];
        let start = Global.tiles.find(t => t.attrs.type == "start");

        function getNextTile(tile) {
            let zones = tile.children.filter(t => t.attrs.tag == "snapzone" && t.attrs.snap != null);
            for (let i in zones) {
                let zone = zones[i];
                let other = zone.attrs.snap.parent;
                if (tiles.includes(other))
                    continue;
                return other;
            }
            return null;
        }

        let next = start;
        // go from the start to one site
        do {
            tiles.push(next);
            //Global.layer.add(new Konva.Circle({x: next.absolutePosition().x, y: next.absolutePosition().y, radius:5, fill:"red"}));
            next = getNextTile(next);
        } while (next != null);
        // check if we have any tiles from the start left (by having a jump for example) and add those
        next = getNextTile(start);
        if (next != null) {
            do {
                tiles.unshift(next);
                next = getNextTile(next);
            } while (next != null);
        }
        // transform konva tiles to serialized tiles
        track.tiles = tiles.map(t => new Tile(t.attrs.type, t.rotation()));
        return track;
    }
}