const nobLength = 7;
const snapZone = 10;

function createCanvas() {
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

    function setCanvasSize() {
        Global.stage.width(window.innerWidth);
        Global.stage.height(window.innerHeight);
    }

    // listen to resize
    window.onresize = () => setCanvasSize();
    // set size
    setCanvasSize();
}

function isInside(r1, p) {
    return (p.x >= r1.x && p.x <= r1.x + r1.width) &&
        (p.y >= r1.y && p.y <= r1.y + r1.height);
}

function haveIntersection(r1, r2) {
    return !(
        r2.x > r1.x + r1.width ||
        r2.x + r2.width < r1.x ||
        r2.y > r1.y + r1.height ||
        r2.y + r2.height < r1.y
    );
}

function moveGroupToSnapzone(group, otherGroup, zone, otherZone) {
    // first get the pos diff between the two zones
    let nearestPos = otherZone.absolutePosition();
    let nearestOtherPos = zone.absolutePosition();
    let posDiff = Vector.diff(nearestPos, nearestOtherPos);
    let groupPos = group.absolutePosition();
    // then go nobLength times to the other track
    let newPos = {x: groupPos.x + posDiff.x, y: groupPos.y + posDiff.y};
    let trackPosDiff = Vector.diff(otherGroup.absolutePosition(), newPos);
    trackPosDiff = Vector.normalize(trackPosDiff);
    newPos.x += trackPosDiff.x * nobLength;
    newPos.y += trackPosDiff.y * nobLength;
    group.absolutePosition(newPos);
    // mark snapzone as used so we cant double use a snap
    zone.attrs.snap = otherZone;
    otherZone.attrs.snap = zone;
    // wed need to check if the other side can be snapped too (example: 3 pieces, middle one is replaced)
    let ourOtherZone = group.children.find(c => c.attrs.tag == "snapzone" && c != zone);
    // first check if we have another snapzone
    if (ourOtherZone != null) {
        // then check every other group
        let otherTiles = Global.layer.children.filter(g => g != group && g != otherGroup);
        let zonePos = ourOtherZone.absolutePosition();
        for (let i in otherTiles) {
            let otherTile = otherTiles[i];
            // check if there is a snapzone that isnt snapped and contains our other snapzone origin
            let found = otherTile.children.find(z => z.attrs.tag == "snapzone" && z.attrs.snap == null && isInside(z.getClientRect(), zonePos));
            if (found) {
                // mark that one too
                found.attrs.snap = ourOtherZone;
                ourOtherZone.attrs.snap = found;
                break;
            }
        }
    }
}

function toggleSnapzones(val) {
    Global.layer.getChildren().forEach((group) => {
        group.getChildren().forEach((child) => {
            if (child.attrs.tag != "snapzone")
                return;
            child.visible(val);
        })
    })
}

function removeSnap(group) {
    let zones = group.children.filter(c => c.attrs.tag == "snapzone" && c.attrs.snap != null);
    for (let i in zones) {
        let zone = zones[i];
        let other = zone.attrs.snap;
        // remove the snap
        zone.attrs.snap = null;
        other.attrs.snap = null;
    }
}

function checkSnap(group) {
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
        if (haveIntersection(nearest.getClientRect(), nearestOther.getClientRect())) {
            // disallow overlaying snaps
            // check if the direction from the group origin to the snapzone is the same for both zones (dot product > 0)
            let dot = Vector.dot(Vector.diff(nearest.absolutePosition(), otherTrackPos), Vector.diff(nearestOther.absolutePosition(), pos));
            if (dot > 0) {
                console.error("detected overlap");
                break;
            }
            moveGroupToSnapzone(group, g, nearestOther, nearest);
            break;
        }
    }
}

function addTrack(type, url, x, y, index) {
    let promise = new Promise((resolve, reject) => {
        Konva.Image.fromURL(url, function (track) {
            let trackType = type;
            switch (type) {
                case "xstraight":
                case "ystraight":
                case "start":
                    trackType = "straight";
            }
            var group = new Konva.Group({
                x: x,
                y: y,
                type: type,
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
                group.rotate(45);
            });
            group.on("dblclick dbltap", (e) => {
                if (e.evt.button == 2) // dont rotate on right click double click
                    return;
                group.rotate(45);
            });

            group.on("dragstart", () => {
                if (!Global.forceShowSnapzones)
                    toggleSnapzones(true);
                removeSnap(group);
            });
            group.on("dragend", () => {
                if (!Global.forceShowSnapzones)
                    toggleSnapzones(false);
                checkSnap(group);
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

            switch (trackType) {
                case "straight": {
                    let snapTop = createSnapzone(-width / 2 - snapZone, -height / 2 - snapZone, width + snapZone * 2, snapZone * 3);
                    group.add(snapTop);
                    let snapBottom = createSnapzone(-width / 2 - snapZone, height / 2 - snapZone * 2, width + snapZone * 2, snapZone * 3);
                    group.add(snapBottom);
                    break;
                }
                case "curve": { //TODO: i think the right snapzone is off by one?
                    let snapRight = createSnapzone(-snapZone + 5, -snapZone * 3 + 2, height, snapZone * 3, 90);
                    group.add(snapRight);
                    let snapBottom = createSnapzone(-width / 2 - snapZone - 3, height / 2 - snapZone * 2, width, snapZone * 3);
                    group.add(snapBottom);
                    break;
                }
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
const presetRect = {x1: 50, y1: 100, x2: 150, y2: 500};
const tilesPerRow = 3;

function initPresets() {
    Global.tiles = [];
    let index = 0;

    function addPreset(track) {
        let url = `assets/${track}.png`;
        let ret = addTrack(track, url, 0, 0, index);
        index++;
        return ret;
    }

    let promises = [];
    promises.push(addPreset("start"));
    for (let i = 0; i < 5; i++) {
        promises.push(addPreset("straight"));
    }
    for (let i = 0; i < 12; i++) {
        promises.push(addPreset("curve"));
    }
    promises.push(addPreset("ramp"));
    promises.push(addPreset("rampEnd"));
    promises.push(addPreset("xstraight"));
    promises.push(addPreset("ystraight"));
    Promise.all(promises).then(() => {
        clearTracks();
    });
}

function clearTracks() {
    let tilesAdded = 0;
    for (let i in Global.tiles) {
        let tile = Global.tiles[i];
        let x = tilesAdded % tilesPerRow * (presetRect.x2 - presetRect.x1 / tilesPerRow) + presetRect.x1;
        let y = Math.floor(tilesAdded / tilesPerRow) * 100 + presetRect.y1;
        tile.rotation(0);
        tile.absolutePosition(new Vector(x, y));
        tile.children.filter(c => c.attrs.tag == "snapzone").forEach(z => z.attrs.snap = null);
        tilesAdded++;
    }
}