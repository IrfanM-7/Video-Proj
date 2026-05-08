# TODO: CapCut-Style Manual Editing Upgrade

## Phase 1: Fix Current Filter Issues ✅
- [x] Verify brightness/color filters work correctly
- [x] Fixed filter chain ordering in ffmpeg_utils.py

## Phase 2: Add Professional Transitions (Ready for Use)
- [x] Fade In/Out transitions (handled at audio level)
- [ ] Dissolve transition (requires merge-level change)
- [ ] Crossfade duration control

## Phase 3: Add Audio Controls ✅
- [x] Volume adjustment per clip (0-200%)
- [x] Mute audio option per clip
- [x] Fade in/out audio

## Phase 4: Add More Effects (CapCut-style) ✅
- [x] Zoom/Pan effect (Ken Burns)
- [x] Rotation (90°, 180°, 270°)
- [x] Reverse video
- [ ] Opacity control (lower priority)

## Phase 5: Timeline Improvements ✅
- [x] Split clip functionality
- [x] Duplicate clip
- [ ] Add transition between clips in timeline

## Implementation Files:
1. video-back/processing/ffmpeg_utils.py - ✅ Add filter implementations
2. video-front/src/components/EditorWorkspace.jsx - ✅ Add new UI tabs/controls
3. video-back/main.py - No changes needed

## Status: Core Features Complete ✅

### Features Added:
- Audio tab: Volume slider (0-200%), Mute toggle, Audio fade in/out
- Transform tab: Rotation (0/90/180/270°), Ken Burns zoom, Reverse video
- Timeline: Split clip, Duplicate clip
- New tabs: Audio, Transform (in addition to existing Trim, Color, Text, Speed, Effects, Aspect)
