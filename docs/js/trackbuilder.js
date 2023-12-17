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

const tracks = [{
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
}];

function buildTrack(track) {
    let usedTiles = [];
    let prevTile = null;
    let nextZone = null;
    for (let i in track) {
        let info = track[i];
        // get a matching tile
        let tile = tiles.find(t => t.attrs.type == info.type && !usedTiles.includes(t));
        if (tile == null) {
            console.error("not enough tiles.");
            return;
        }
        // place the tile
        tile.rotation(info.angle);
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
        } else {
            // get the right zone
            let zones = tile.children.filter(c => c.attrs.tag == "snapzone");
            let pos = tile.absolutePosition();
            // get the local offset of the previous snapzone
            let offset = diff(prevTile.absolutePosition(), nextZone.absolutePosition());
            // then add that onto our current pos to get the absolutepos where our next snapzone should be
            let nextZonePos = {
                x: pos.x + offset.x,
                y: pos.y + offset.y
            };
            // now find out which actual snapzone is closest to that point
            let ourZone = zones.sort((a, b) => dist(a.absolutePosition(), nextZonePos) - dist(b.absolutePosition(), nextZonePos))[0];
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