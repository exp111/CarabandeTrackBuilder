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
            new Tile("straight", 90),
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
                if (!info.Type || !Global.tiles.find(t => t.attrs.type == info.Type))
                    console.error(`Could not find tile with type ${info.Type}. Invalid track?`)
                else
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

    random() {
        let availableTiles = [];
        let availableTracktypes = {};
        for (let i in Global.tiles) {
            let tile = Global.tiles[i];
            let type = tile.attrs.trackType;
            switch (type) {
                case "ramp":
                case "rampEnd":
                    //TODO: add ramp
                    break;
                default:
                    availableTiles.push({
                        index: i,
                        type: tile.attrs.type,
                        trackType: type
                    });
                    if (availableTracktypes[type]) {
                        availableTracktypes[type]++;
                    } else {
                        availableTracktypes[type] = 1;
                    }
                    break;
            }

        }
        console.log("availableTiles:");
        console.log(availableTiles);
        let usedTiles = {};
        let usedTracktypes = {};
        for (let i in availableTracktypes)
            usedTracktypes[i] = 0;

        function randomIndex(arr) {
            return Math.floor(Math.random() * arr.length)
        }

        function getRandomTile(used, suggestion) {
            let types = ["straight", "curve"];
            //TODO: change odds to be relative to the amount of tiles
            // filter out any tracktypes that are not available anymore or were already tried
            types = types.filter(t => availableTracktypes[t] > usedTracktypes[t] && !(used[t] != null && used[t].triedAll));
            if (types.length == 0)
                return null;
            if (suggestion != null) {
                if (types.includes(suggestion))
                    return {trackType: suggestion};
                else return null;
            }

            let index = randomIndex(types);
            return {
                trackType: types[index]
            };
        }

        function checkTrack(track, tile) {
            let grid = {0: {}};
            let x = 0;
            let y = 0;

            function next(direction) {
                switch (direction) {
                    case "l":
                        x--;
                        break;
                    case "r":
                        x++;
                        break;
                    case "u":
                        y++;
                        break;
                    case "d":
                        y--;
                        break;
                }
            }

            for (let i in track) {
                let t = track[i];
                grid[x][y] = t;
                next(t.direction);
                // check if the column exists
                if (!grid[x]) {
                    grid[x] = {};
                }
                // if the tile is already marked, we have a collision
                if (grid[x][y]) {
                    return -1;
                }
            }
            next(tile.direction);
            if (!grid[x]) { // next column doesnt exist, so its empty
                return 0;
            }
            let last = grid[x][y];
            if (last) {
                if (last.type == "start")
                    return 1;
                return -1; // collision
            }
            return 0;
        }

        function getValidDirection(prev, next) {
            //TODO: skewed directions
            next.prevDirection = prev.direction;
            switch (prev.trackType) {
                case "straight": {
                    switch (next.trackType) {
                        case "straight":
                            return [prev.direction];
                            if (prev.direction == "l" || prev.direction == "r")
                                return ["l", "r"];
                            if (prev.direction == "u" || prev.direction == "d")
                                return ["u", "d"];
                        case "curve":
                            if (prev.direction == "l" || prev.direction == "r")
                                return ["u", "d"];
                            if (prev.direction == "u" || prev.direction == "d")
                                return ["l", "r"];
                    }
                }
                case "curve": {
                    switch (next.trackType) {
                        case "straight":
                            return [prev.direction];
                            if (prev.direction == "l" || prev.direction == "r")
                                return ["l", "r"];
                            if (prev.direction == "u" || prev.direction == "d")
                                return ["u", "d"];
                        case "curve":
                            if (prev.direction == "l" || prev.direction == "r")
                                return ["u", "d"];
                            if (prev.direction == "u" || prev.direction == "d")
                                return ["l", "r"];
                    }
                }
            }
            console.error("Could not get a valid direction");
            return null;
        }

        function getRotationFromDirection(tile) {
            switch (tile.trackType) {
                case "straight":
                    switch (tile.direction) {
                        case "l":
                            return 270;
                        case "r":
                            return 90;
                        case "u":
                            return 0;
                        case "d":
                            return 180;
                    }
                case "curve":
                    switch (tile.direction) {
                        case "l":
                            return tile.prevDirection == "u" ? 90 : 180;
                        case "r":
                            return tile.prevDirection == "u" ? 0 : 270;
                        case "u":
                            return tile.prevDirection == "r" ? 180 : 270;
                        case "d":
                            return tile.prevDirection == "r" ? 90 : 0;
                    }
            }
        }

        function getRandomType(trackType) {
            let filtered = availableTiles.filter(t => t.trackType == trackType && !usedTiles[t.index]);
            if (filtered.length == 0) {
                console.error(`no tiles of tracktype ${trackType} left`);
                return null;
            }
            let index = randomIndex(filtered);
            let selected = filtered[index];
            usedTiles[selected.index] = true;
            return selected.type;
        }

        let cap = 7;
        let track = [];
        let used = {}
        console.log("track gen:");
        // force the start as the first tile
        track.push({type: "start", trackType: "straight", direction: "r"})//TODO: allow other start directions than r (needs to be fixed in the track builder)
        // mark them as used
        usedTracktypes["straight"]++;
        usedTiles[availableTiles.find(t => t.type == "start").index] = true;
        // now for the rest of the track
        for (let i = 1; i < cap; i++) {
            let tile = null;
            if (!used[i])
                used[i] = {};
            while (tile == null) {
                // get a random tile
                let suggestion = null;
                switch (i) {
                    case 1:
                    case 2:
                    case 4:
                    case 5:
                        suggestion = "curve";
                        break;
                    case 3:
                        suggestion = "straight";
                        break;
                }
                tile = getRandomTile(used[i], suggestion);

                //TODO: we can optimize this by checking if we can potentially go from that tile in cap-i steps to the goal
                if (tile == null) {
                    console.error(`no tiles available ${i}`);
                    for (let j in used[i]) {
                        console.log(used[i][j]);
                    }
                    // remove the previous tile as it cant work like this
                    let prev = track.pop();
                    usedTracktypes[prev.trackType]--;
                    // clear the future combinations
                    used[i] = {};
                    i--;
                    if (i < 1) {
                        console.error("oob");
                        i = cap;
                        break;
                    }
                    // mark the previous direction as used
                    if (used[i][prev.trackType]) {
                        used[i][prev.trackType].directions.push(prev.direction);
                    } else {
                        used[i][prev.trackType] = {
                            triedAll: false,
                            directions: [prev.direction]
                        };
                    }
                    continue;
                }
                //TODO: if we dont get a tile here, we need to go back one step
                //valid rotations //TODO: skew
                let prev = track[track.length - 1];
                let validDirections = getValidDirection(prev, tile);
                // remove used directions
                if (used[i][tile.trackType]) {
                    // filter out any directions that were previously used
                    validDirections = validDirections.filter(d => !used[i][tile.trackType].directions.includes(d));
                }
                // if all directions were used
                if (validDirections.length == 0) {
                    used[i][tile.trackType].triedAll = true;
                    console.error(`tracktype ${tile.trackType} was fully tried`);
                    tile = null;
                    continue;
                }

                // getrandomrotation
                tile.direction = validDirections[randomIndex(validDirections)];

                let newDir = null;
                switch (i) {
                    case 1:
                        newDir = "u";
                        break;
                    case 2:
                        newDir = "l";
                        break;
                    case 3:
                        newDir = "l";
                        break;
                    case 4:
                        newDir = "d";
                        break;
                    case 5:
                        newDir = "r";
                        break;
                }
                if (newDir != null) {
                    if (validDirections.includes(newDir)) {
                        console.log(`(${i}) overwriting dir ${tile.direction} with ${newDir}`);
                        tile.direction = newDir;
                    }
                    else {
                        console.log(`${newDir} not valid?`);
                    }
                }

                //console.log(tile);
                let result = checkTrack(track, tile);
                if (result == 1) { // goal
                    track.push(tile);
                    console.log("end");
                    i = cap;
                    break;
                }
                else if (result == 0) { // no collision
                    // use tile
                    usedTracktypes[tile.trackType]++;
                    track.push(tile);
                    // if we're not at the last tile, this is just a valid tile
                    if (i != cap - 1)
                        continue;

                    console.error("did not reach end");
                    track.pop();
                    usedTracktypes[tile.trackType]--;
                }
                // collision
                // dont use tile
                if (used[i][tile.trackType]) {
                    used[i][tile.trackType].directions.push(tile.direction);
                } else {
                    used[i][tile.trackType] = {
                        triedAll: false,
                        directions: [tile.direction]
                    };
                }
                tile = null;
            }
        }
        console.log("track:");
        console.log(track);
        //TODO: randomize straight rotation
        this.buildTrack({tiles: track.map(t => new Tile(t.type ?? getRandomType(t.trackType), getRotationFromDirection(t)))});
    }
}