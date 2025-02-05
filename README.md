# Carabande Track Builder
Allows to build Carabande/PitchCar tracks digitally.
Inspired by [YellowLab's track builder](https://boardgamegeek.com/filepage/32395/pitchcar-trackbuilder)

## Features
- Supports Carabande + Action Set
- Supports PitchCar + L'Extension + Extension 1, 2, 3, 5, 6, 8
- Track building with (optional) snapping + rotation
- Random Track Generator! (Doesn't support jumps/ramps yet)
- A few preset tracks (The current jump tracks are only for carabande)

## TODO
- add other extensions (stunt pack, epsilon)
- fix tile selection overlapping
- fix long tiles blocking all other tiles in the selection
- add 45° curves to the track generator
- fix curves sometimes causing a 1-2 pixel offset
- support bridge, fill snapping; fix expansion 6 parts snapping to incompatible parts

## Known Issues
- Firefox's privacy.resistFingerprinting massively cripples Konva's drag performance. I exempted the domain to fix this.