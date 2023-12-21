class Trackgenerator {
    existingTypes = [];
    availableTiles = [];
    availableTracktypes = {};
    usedTiles = {};
    usedTracktypes = {};

    randomIndex(arr) {
        return Math.floor(Math.random() * arr.length);
    }

    randomElement(arr) {
        return arr[this.randomIndex(arr)];
    }

    getRandomTile(used) {
        let types = this.existingTypes;
        // filter out any tracktypes that are not available anymore or were already tried
        types = types.filter(t => this.availableTracktypes[t] > this.usedTracktypes[t] && !(used[t] != null && used[t].triedAll));
        if (types.length == 0)
            return null;

        // calculate the odds of each tile
        let tresholds = [];
        let current = 0;
        for (let i in types) {
            let type = types[i];
            let treshold = {
                type: type,
                treshold: current + (this.availableTracktypes[type] - this.usedTracktypes[type])
            };
            tresholds.push(treshold);
            current = treshold.treshold;
        }
        let last = tresholds[tresholds.length - 1];
        // max number we can get
        let max = last.treshold;
        let val = Math.floor(Math.random() * max);
        // find in which type range the generated number falls in
        let type = tresholds.find(t => t.treshold > val);

        return {
            trackType: type.type
        };
    }

    checkTrack(track, tile) {
        let grid = {0: {}};
        let x = 0;
        let y = 0;

        function next(direction) {
            // skewed dirs can be calculated the same way (up gives y++, down gives y--)
            // so iterate over all chars
            for (let i in direction) {
                let dir = direction[i];
                switch (dir) {
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
            if (last.type == "start") {
                // if its the start tile, check if the direction of the start tile is valid relative to the last tile,
                // meaning that the last tile connects properly to the start and doesnt crash into ti
                return this.getValidDirection(tile, last).includes(last.direction) ? 1 : -1;
            }

            return -1; // collision
        }
        return 0;
    }

    getValidDirection(prev, next) {
        next.prevDirection = prev.direction;
        switch (next.trackType) {
            case "straight":
                return [prev.direction];
            case "curve":
                if (prev.direction == "ul" || prev.direction == "dr")
                    return ["dl", "ur"];
                if (prev.direction == "ur" || prev.direction == "dl")
                    return ["dr", "ul"];
                if (prev.direction == "l" || prev.direction == "r")
                    return ["u", "d"];
                if (prev.direction == "u" || prev.direction == "d")
                    return ["l", "r"];
        }
        console.error("Could not get a valid direction");
        return null;
    }

    getRotationFromDirection(tile, randomizeStraight) {
        let direction = tile.direction;
        let offset = 0;
        // if we have a skewed dir, we need to offset the pos by 45/-45 degrees
        if (direction.length > 1) {
            switch (direction) {
                case "ur":
                case "dl":
                    offset = -45;
                    break;
                case "ul":
                case "dr":
                    offset = 45;
            }
            direction = direction[1];
        }
        let prevDirection = tile.prevDirection != null ? tile.prevDirection[0] : null;
        switch (tile.trackType) {
            case "straight":
                switch (direction) {
                    case "l":
                        return offset + (randomizeStraight ? this.randomElement([90, 270]) : 270);
                    case "r":
                        return offset + (randomizeStraight ? this.randomElement([90, 270]) : 90);
                    case "u":
                        return offset + (randomizeStraight ? this.randomElement([0, 180]) : 0);
                    case "d":
                        return offset + (randomizeStraight ? this.randomElement([0, 180]) : 180);
                }
            case "curve":
                switch (direction) {
                    case "l":
                        return offset + (prevDirection == "u" ? 90 : 180);
                    case "r":
                        return offset + (prevDirection == "u" ? 0 : 270);
                    case "u":
                        return offset + (prevDirection == "r" ? 180 : 270);
                    case "d":
                        return offset + (prevDirection == "r" ? 90 : 0);
                }
        }
    }

    // Gets a random type with the given track type from the available tracks and marks it as used
    getRandomType(trackType) {
        // filter out any tiles that have a different tracktype or are used
        let filtered = this.availableTiles.filter(t => t.trackType == trackType && !this.usedTiles[t.index]);
        if (filtered.length == 0) {
            //console.debug(`no tiles of tracktype ${trackType} left`);
            return null;
        }
        let selected = this.randomElement(filtered);
        // mark the tile as used
        this.usedTiles[selected.index] = true;
        return selected.type;
    }

    generateTrack(min, max) {
        this.availableTiles = [];
        this.availableTracktypes = {};
        for (let i in Global.tiles) {
            let tile = Global.tiles[i];
            let trackType = tile.attrs.trackType;
            switch (trackType) {
                case "straight":
                case "curve":
                    this.availableTiles.push({
                        index: i,
                        type: tile.attrs.type,
                        trackType: trackType
                    });
                    if (this.availableTracktypes[trackType]) {
                        this.availableTracktypes[trackType]++;
                    } else {
                        this.availableTracktypes[trackType] = 1;
                    }
                    break;
                default:
                    //TODO: add ramp
                    //TODO: add curve
                    break;
            }
        }
        if (min > this.availableTiles.length) {
            alert(`There are only ${this.availableTiles.length} tiles available`);
            return null;
        }
        //console.debug("availableTiles:");
        //console.debug(availableTiles);
        this.existingTypes = Object.keys(this.availableTracktypes);
        this.usedTiles = {};
        this.usedTracktypes = {};
        for (let i in this.availableTracktypes)
            this.usedTracktypes[i] = 0;

        // generation
        let track = [];
        let used = {}
        //console.debug("track gen:");
        // force the start as the first tile
        track.push({type: "start", trackType: "straight", direction: "r"})//TODO: allow other start directions than (u/d)r (needs to be fixed in the track builder)
        // mark them as used
        this.usedTracktypes["straight"]++;
        this.usedTiles[this.availableTiles.find(t => t.type == "start").index] = true;
        // now for the rest of the track
        for (let i = 1; i < max; i++) {
            let tile = null;
            if (!used[i])
                used[i] = {};
            while (tile == null) {
                // get a random tile
                tile = this.getRandomTile(used[i]);

                //TODO: we can optimize this by checking if we can potentially go from that tile in max-i steps to the goal

                // if we dont get a tile here, we need to go back one step
                if (tile == null) {
                    //console.debug(`no tiles available ${i}`);
                    // remove the previous tile as it cant work like this
                    let prev = track.pop();
                    this.usedTracktypes[prev.trackType]--;
                    // clear the future combinations
                    used[i] = {};
                    i--;
                    if (i < 1) {
                        console.error("oob");
                        alert(`Could not find a track with a minimum of ${min} and a maximum of ${max} tiles.`);
                        i = max;
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
                //valid rotations
                let prev = track[track.length - 1];
                let validDirections = this.getValidDirection(prev, tile);
                // remove used directions
                if (used[i][tile.trackType]) {
                    // filter out any directions that were previously used
                    validDirections = validDirections.filter(d => !used[i][tile.trackType].directions.includes(d));
                }
                // if all directions were used
                if (validDirections.length == 0) {
                    used[i][tile.trackType].triedAll = true;
                    //console.debug(`tracktype ${tile.trackType} was fully tried`);
                    tile = null;
                    continue;
                }

                // getrandomrotation
                tile.direction = this.randomElement(validDirections);

                //console.debug(tile);
                let result = this.checkTrack(track, tile);
                if (result == 1) { // goal
                    if (i >= (min - 1)) { // if we meet the minimum amount of tiles, we can quit
                        track.push(tile);
                        console.debug("end");
                        i = max;
                        break;
                    }
                    // else let it count as a collision
                } else if (result == 0) { // no collision
                    // use tile
                    if (i < max - 1) { // if we're not at the last tile, this is just a valid tile
                        this.usedTracktypes[tile.trackType]++;
                        track.push(tile);
                        continue;
                    }
                    // else we have the maximum amount of tiles but didnt reach the finish, so count it as a collision
                    //console.debug("did not reach end");
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
        console.debug("track:");
        console.debug(track);
        return {
            tiles: track.map(t =>
                new Tile(
                    // if the type is already set use that, otherwise get a random available one for the track type
                    t.type ?? this.getRandomType(t.trackType),
                    // get the rotation through the direction (and randomize if its a straight)
                    this.getRotationFromDirection(t, true)))
        };
    }
}