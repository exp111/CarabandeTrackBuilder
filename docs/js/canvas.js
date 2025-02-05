class Canvas {
    static trackWidth = 52;
    static nobLength = 7;
    static snapZone = 10;

    createCanvas() {
        Global.stage = new Konva.Stage({
            container: 'canvas',   // id of container <div>
            draggable: true
        });
        Global.stage.on('contextmenu', function (e) {
            // prevent default behavior
            e.evt.preventDefault();
        });
        Global.layer = new Konva.Layer();
        Global.stage.add(Global.layer);


        // listen to resize
        window.onresize = () => this.setCanvasSize();
        // set size
        this.setCanvasSize();
    }

    setCanvasSize() {
        Global.stage.width(window.innerWidth);
        Global.stage.height(window.innerHeight);
    }


    isInside(r1, p) {
        return (p.x >= r1.x && p.x <= r1.x + r1.width) &&
            (p.y >= r1.y && p.y <= r1.y + r1.height);
    }


    haveIntersection(r1, r2) {
        return !(
            r2.x > r1.x + r1.width ||
            r2.x + r2.width < r1.x ||
            r2.y > r1.y + r1.height ||
            r2.y + r2.height < r1.y
        );
    }


    moveGroupToSnapzone(group, otherGroup, zone, otherZone) {
        // first get the pos diff between the two zones
        let nearestPos = otherZone.absolutePosition();
        let nearestOtherPos = zone.absolutePosition();
        let posDiff = Vector.diff(nearestPos, nearestOtherPos);
        let groupPos = group.absolutePosition();
        // then go nobLength times to the other track
        let newPos = {x: groupPos.x + posDiff.x, y: groupPos.y + posDiff.y};
        let trackPosDiff = Vector.diff(otherGroup.absolutePosition(), newPos);
        trackPosDiff = Vector.normalize(trackPosDiff);
        newPos.x += trackPosDiff.x * Canvas.nobLength;
        newPos.y += trackPosDiff.y * Canvas.nobLength;
        group.absolutePosition(newPos);
        // mark snapzone as used so we cant double use a snap
        zone.attrs.snap = otherZone;
        otherZone.attrs.snap = zone;
        // wed need to check if the other sides can be snapped too (example: 3 pieces, middle one is replaced)
        let ourOtherZones = group.children.filter(c => c.attrs.tag == "snapzone" && c != zone);
        // first check if we have another snapzone
        if (ourOtherZones != null) {
            // check every other group
            let otherTiles = Global.layer.children.filter(g => g != group && g != otherGroup);
            // for each zone check if the zone is inside another group
            for (let i in ourOtherZones) {
                let ourOtherZone = ourOtherZones[i];
                let zonePos = ourOtherZone.absolutePosition();
                for (let i in otherTiles) {
                    let otherTile = otherTiles[i];
                    // check if there is a snapzone that isnt snapped and contains our other snapzone origin
                    let found = otherTile.children.find(z => z.attrs.tag == "snapzone" && z.attrs.snap == null && this.isInside(z.getClientRect(), zonePos));
                    if (found) {
                        // mark that one too
                        found.attrs.snap = ourOtherZone;
                        ourOtherZone.attrs.snap = found;
                        break;
                    }
                }
            }
        }
    }


    toggleSnapzones(val) {
        Global.layer.getChildren().forEach((group) => {
            group.getChildren().forEach((child) => {
                if (child.attrs.tag != "snapzone")
                    return;
                child.visible(val);
            })
        })
    }


    removeSnap(group) {
        let zones = group.children.filter(c => c.attrs.tag == "snapzone" && c.attrs.snap != null);
        for (let i in zones) {
            let zone = zones[i];
            let other = zone.attrs.snap;
            // remove the snap
            zone.attrs.snap = null;
            other.attrs.snap = null;
        }
    }


    //TODO: allow different type of snapzones as some parts cant be snapped together (expansion 6)
    checkSnap(group) {
        if (Global.disableSnapping)
            return;
        let children = group.getChildren();
        let track = children.find(n => n.attrs.tag == "track");
        let pos = track.absolutePosition();

        let snapZones = children.filter(n => n.attrs.tag == "snapzone");
        //first filter out the current group, then sort by distance
        let groups = Global.layer.getChildren().filter(g => g != group).sort((a, b) => Vector.dist(a.absolutePosition(), pos) - Vector.dist(b.absolutePosition(), pos));
        for (let i in groups) {
            let g = groups[i];
            // get the other track
            let otherChildren = g.getChildren();
            let otherTrack = otherChildren.find(n => n.attrs.tag == "track");
            let otherTrackPos = otherTrack.absolutePosition();
            // filter out zones that are already snapped
            let otherZones = otherChildren.filter(n => n.attrs.tag == "snapzone" && n.attrs.snap == null);
            // find the nearest snapzones
            let nearest = otherZones.sort((a, b) => Vector.dist(a.absolutePosition(), pos) - Vector.dist(b.absolutePosition(), pos))[0];
            let nearestOther = snapZones.sort((a, b) => Vector.dist(a.absolutePosition(), otherTrackPos) - Vector.dist(b.absolutePosition(), otherTrackPos))[0];
            if (nearest == null || nearestOther == null)
                continue;
            // check the rotation
            let nearestRot = nearest.getAbsoluteRotation();
            let nearestOtherRot = nearestOther.getAbsoluteRotation();
            // normalize them
            nearestRot = Math.round((nearestRot + 180) % 180);
            nearestOtherRot = Math.round((nearestOtherRot + 180) % 180);
            if (nearestRot != nearestOtherRot)
                continue;
            if (this.haveIntersection(nearest.getClientRect(), nearestOther.getClientRect())) {
                // disallow overlaying snaps
                // check if the direction from the group origin to the snapzone is the same for both zones (dot product > 0)
                let dot = Vector.dot(Vector.diff(nearest.absolutePosition(), otherTrackPos), Vector.diff(nearestOther.absolutePosition(), pos));
                if (dot > 0) {
                    console.error("detected overlap");
                    break;
                }
                this.moveGroupToSnapzone(group, g, nearestOther, nearest);
                break;
            }
        }
    }

    rotateGroup(group, deg = 45) {
        group.rotate(deg);
        // remove snapped zones, check new snap
        this.removeSnap(group);
        this.checkSnap(group);
    }

    addTrack(type, url, x, y, packId, index, count) {
        let base = this;
        let promise = new Promise((resolve, reject) => {
            Konva.Image.fromURL(url, function (track) {
                let trackType = type;
                switch (type) {
                    case "xstraight":
                    case "ystraight":
                    case "cstraight":
                    case "halfstraight":
                    case "start":
                        trackType = "straight";
                        break;
                    case "halfcurve":
                    case "ccurve":
                        trackType = "curve";
                        break;
                }
                var group = new Konva.Group({
                    x: x,
                    y: y,
                    type: type,
                    pack: packId,
                    count: count,
                    trackType: trackType,
                    draggable: true,
                });
                let width = track.width();
                let height = track.height();
                track.setAttrs({
                    tag: "track",
                    type: type,
                    offset: {x: width / 2, y: height / 2},
                });
                group.add(track);

                group.on("mousedown", (e) => {
                    if (e.evt.button != 2)
                        return;
                    base.rotateGroup(group);
                });
                group.on("dblclick dbltap", (e) => {
                    if (e.evt.button == 2) // dont rotate on right click double click
                        return;
                    base.rotateGroup(group);
                });

                group.on("dragstart", () => {
                    if (!Global.forceShowSnapzones && !Global.disableSnapping)
                        base.toggleSnapzones(true);
                    base.removeSnap(group);
                });
                group.on("dragend", () => {
                    if (!Global.forceShowSnapzones)
                        base.toggleSnapzones(false);
                    base.checkSnap(group);
                });

                function createSnapzone(x, y, w, h, angle) {
                    return new Konva.Rect({
                        x: x + w / 2,
                        y: y + h / 2,
                        width: w,
                        height: h,
                        stroke: "red",
                        strokeWidth: 1,
                        visible: Global.forceShowSnapzones,
                        rotation: angle ?? 0,
                        tag: "snapzone",
                        offset: {x: w / 2, y: h / 2},
                    });
                }

                let snapZone = Canvas.snapZone;

                switch (trackType) {
                    case "long":
                    case "multistraight1":
                    case "multistraight2":
                    case "straight": {
                        let snapTop = createSnapzone(-width / 2 - snapZone, -height / 2 - snapZone, width + snapZone * 2, snapZone * 3);
                        group.add(snapTop);
                        let snapBottom = createSnapzone(-width / 2 - snapZone, height / 2 - snapZone * 2, width + snapZone * 2, snapZone * 3);
                        group.add(snapBottom);
                        break;
                    }
                    case "curve": { //TODO: i think the right snapzone is off by one?
                        let snapRight = createSnapzone(-snapZone + 6, -snapZone * 3 + 2, Canvas.trackWidth + snapZone * 2, snapZone * 3, 90);
                        group.add(snapRight);
                        let snapBottom = createSnapzone(-width / 2 - snapZone - 1, height / 2 - snapZone * 2, Canvas.trackWidth + snapZone * 2, snapZone * 3);
                        group.add(snapBottom);
                        break;
                    }
                    case "curve45": { //FIXME: these seem a bit off when snapped to non 45 deg curves. maybe its the sprite?
                        let snapRight = createSnapzone(-snapZone * 2 - 4, -snapZone * 3 + 3, Canvas.trackWidth + snapZone * 2, snapZone * 3, 45);
                        group.add(snapRight);
                        let snapBottom = createSnapzone(-width / 2 - snapZone, height / 2 - snapZone * 2, Canvas.trackWidth + snapZone * 2, snapZone * 3);
                        group.add(snapBottom);
                        break;
                    }
                    case "upsilon": {
                        let snapTopL = createSnapzone(-Canvas.trackWidth * 1.5 - snapZone - 3 + 13, -height / 2 - snapZone + 1, Canvas.trackWidth + snapZone * 2, snapZone * 3);
                        group.add(snapTopL);
                        let snapTopR = createSnapzone(Canvas.trackWidth / 2 - snapZone + 5 - 12, -height / 2 - snapZone + 1, Canvas.trackWidth + snapZone * 2, snapZone * 3);
                        group.add(snapTopR);
                        let snapBottom = createSnapzone(-Canvas.trackWidth / 2 - snapZone + 1, height / 2 - snapZone * 2, Canvas.trackWidth + snapZone * 2, snapZone * 3);
                        group.add(snapBottom);
                        break;
                    }
                    case "cross": {
                        let snapTop = createSnapzone(-Canvas.trackWidth / 2 - snapZone, -height / 2 - snapZone, Canvas.trackWidth + snapZone * 2, snapZone * 3);
                        group.add(snapTop);
                        let snapBottom = createSnapzone(-Canvas.trackWidth / 2 - snapZone, height / 2 - snapZone * 2, Canvas.trackWidth + snapZone * 2, snapZone * 3);
                        group.add(snapBottom);
                        let snapLeft = createSnapzone(-Canvas.trackWidth - snapZone * 3 + 2, -snapZone - 5, Canvas.trackWidth + snapZone * 2, snapZone * 3, 90);
                        group.add(snapLeft);
                        let snapRight = createSnapzone(Canvas.trackWidth / 2 - snapZone * 2 + 2, -snapZone - 5, Canvas.trackWidth + snapZone * 2, snapZone * 3, 90);
                        group.add(snapRight);
                        break;
                    }
                    case "straightEnd":
                    case "jump":
                    case "rampEnd": //TODO: maybe make the rampEnd hitbox smaller?
                    case "ramp": {
                        let snapTop = createSnapzone(-width / 2 - snapZone, -height / 2 - snapZone, width + snapZone * 2, snapZone * 3);
                        group.add(snapTop);
                        break;
                    }
                }
                Global.layer.add(group);
                Global.tiles[index] = group;
                resolve();
            });
        });
        return promise;
    }


    //TODO: add a seperation between normal/addon tiles?
    static tilesPerRow = 3;
    static presetRect = {x1: 50, y1: 100, x2: 150, y2: 500};
    packs = [
        {
            id: "carabande-base",
            tiles: [
                "start",
                "straight", "straight", "straight", "straight", "straight",
                "curve", "curve", "curve", "curve", "curve", "curve", "curve", "curve", "curve", "curve"
            ],
            enabled: true,
            count: 1
        },
        {
            id: "carabande-addon",
            tiles: [
                "curve", "curve",
                "ramp", "rampEnd",
                "xstraight", "ystraight",
            ],
            enabled: true,
            count: 1
        },
        {
            id: "pitchcar-base",
            tiles: [
                "start",
                "straight", "straight", "straight", "straight", "straight",
                "curve", "curve", "curve", "curve", "curve", "curve", "curve", "curve", "curve", "curve"
            ],
            enabled: true,
            count: 1
        },
        {
            id: "pitchcar-addon1",
            tiles: [
                "ccurve", "ccurve", "ccurve", "ccurve",
                "straightEnd", "straightEnd",
                "cstraight",
                "jump", "jump",
                "bridge", "tunnel"
            ],
            enabled: false,
            count: 1
        },
        {
            id: "pitchcar-addon1b",
            tiles: [
                "ccurve", "ccurve", "ccurve", "ccurve",
                "straightEnd", "straightEnd",
                "cstraight", "cstraight",
            ],
            enabled: false,
            count: 1
        },
        {
            id: "pitchcar-addon2",
            tiles: [
                "curve45", "curve45", "curve45", "curve45",
                "curve", "curve",
                "straight", "straight",
            ],
            enabled: false,
            count: 1
        },
        {
            id: "pitchcar-addon3",
            tiles: [
                "long", "long",
            ],
            enabled: false,
            count: 1
        },
        {
            id: "pitchcar-addon5",
            tiles: [
                "cross", "cross",
            ],
            enabled: false,
            count: 1
        },
        {
            id: "pitchcar-addon6",
            tiles: [
                "halfstraight", "halfcurve", "multistraight1", "multistraight1", "multistraight2"
            ],
            enabled: false,
            count: 1
        },
        {
            id: "pitchcar-addon8",
            tiles: [
                "upsilon", "upsilon",
            ],
            enabled: false,
            count: 1
        },
    ];


    togglePack(id, enabled) {
        let pack = this.packs.find(p => p.id == id);
        pack.enabled = enabled;
        if (pack.enabled) {
            // add them
            for (let count = 0; count < pack.count; count++) {
                Promise.all(this.addTracks(pack, Global.tiles.length, count)).then(() => this.resetTracks(pack));
            }
        } else {
            this.removeTracks(pack);
        }
    }

    changePackCount(id, count) {
        let pack = this.packs.find(p => p.id == id);
        let difference = count - pack.count;
        let original = pack.count;
        pack.count = count;
        // only do smth if pack is enabled
        if (pack.enabled) {
            // need to add some
            if (difference > 0) {
                for (let c = count - difference; c < pack.count; c++) {
                    Promise.all(this.addTracks(pack, Global.tiles.length, c)).then(() => this.resetTracks(pack));
                }
            } else if (difference < 0) {
                for (let c = original + difference; c < original; c++) {
                    this.removeTracks(pack, c);
                }
            }
        }
    }

    addPreset(track, packId, index, count) {
        let url = `assets/${track}.png`;
        return this.addTrack(track, url, 0, 0, packId, index, count);
    }

    initPresets(baseID) {
        Global.tiles = [];

        let promises = [];
        let index = 0;
        for (let i in this.packs) {
            let pack = this.packs[i];
            if (pack.enabled) {
                if (baseID != null && !pack.id.startsWith(baseID))
                    continue;

                let packPromises = this.addTracks(pack, index, 0);
                index += packPromises.length;
                promises.push(packPromises);
            }
        }
        Promise.all(promises.flat()).then(() => {
            this.resetTracks();
        });
    }

    addTracks(pack, index, count) {
        let promises = [];
        for (let j in pack.tiles) {
            let tile = pack.tiles[j];
            promises.push(this.addPreset(tile, pack.id, index, count));
            index++;
        }
        return promises;
    }

    removeTracks(pack, count = null) {
        let toRemove = [];
        for (let i in Global.tiles) {
            let tile = Global.tiles[i];
            // if we have a pack id, check for that
            if ((pack != null && pack.id != tile.attrs.pack) ||
                (count != null && pack.count != tile.attrs.count))
                continue;
            tile.remove();
            toRemove.push(tile);
        }
        // remove them
        toRemove.forEach(t => Global.tiles.splice(Global.tiles.indexOf(t), 1));
    }

    resetTracks(pack = null) {
        //FIXME: if you do enable base+addon, then disable and enable base again they will overlap //instead reset all tracks inside the area
        let highestY = 0;
        for (let i in Global.tiles) {
            let tile = Global.tiles[i];
            // if we have a pack id, check for that
            if (pack != null && pack.id != tile.attrs.pack)
                continue;
            let x = i % Canvas.tilesPerRow * (Canvas.presetRect.x2 - Canvas.presetRect.x1 / Canvas.tilesPerRow) + Canvas.presetRect.x1;
            let y = Math.floor(i / Canvas.tilesPerRow) * 100 + Canvas.presetRect.y1;
            if (y > highestY) {
                highestY = y;
            }
            tile.rotation(0);
            tile.absolutePosition(new Vector(x, y));
            tile.children.filter(c => c.attrs.tag == "snapzone").forEach(z => z.attrs.snap = null);
        }

        // adjust canvas height if tiles are placed outside
        if (highestY > Global.stage.height()) {
            Global.stage.height(highestY + 100);
        }
    }
}