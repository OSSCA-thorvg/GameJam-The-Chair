import { createGame } from './game/game';
import { createEffects } from './render/effects';
import { SPLASH_DURATION } from './ui/splash-meta';
import { cleanerRecovery, bucketPour, monitorLight, copierVolley, headImpact, personalBelongings, focusLoss, focusTension, focusHitVignette, extinguisherSpray, urgentCopier } from './preview/office';
import { rooftopEntrance, rooftopTakeoff, shaftHazards, ductSneeze } from './preview/rooftop';
import { orientationRun, expressRun, meetingVisit, chairDispatch, officeTyping } from './preview/building';
import { cloudEntry, skyGustCycle, skyOfficeFacade, skyOfficeGear, skyWindFeedback, skyParrots, skyRobotParrot, skySignDepth, skyPromotionCake, skyEnding, skyToOrbit } from './preview/sky';
import { orbitRoute, orbitEndingScene, orbitSatelliteLightScene, orbitSatelliteLightLitScene } from './preview/orbit';
import { sceneTalk, opening, titleScreen } from './preview/intro';
import type { PreviewScene } from './preview/types';
export type { PreviewScene } from './preview/types';

export type PreviewRegistration = Pick<PreviewScene, 'id' | 'label'> & { create(): PreviewScene };

export const previewScenes: readonly PreviewRegistration[] = [
    { id: "startup-splash", label: "Intro · ThorVG splash", create: () => ({
        id: 'startup-splash', label: 'Intro · ThorVG splash', duration: SPLASH_DURATION,
        focusX: 400,
        markers: [{ at: 0, label: 'Opening' }, { at: 3.5, label: 'Middle' }, { at: 6.9, label: 'End' }],
        sample: () => ({ state: createGame().getSnapshot(), effects: createEffects().snapshot() }),
    }) },
    { id: "title-screen", label: "Intro · Title screen: dash for the exit", create: () => (titleScreen()) },
    { id: "opening", label: "Intro · Opening: overtime until 9 pm", create: () => (opening()) },
    { id: "scene-talk", label: "Office · Stage title, rider reaction and colleague remark", create: () => (sceneTalk()) },
    { id: "bucket-pour", label: "Bucket · Water pour", create: () => (bucketPour()) },
    { id: "cleaner-recovery", label: "Cleaner · Bucket recovery", create: () => (cleanerRecovery()) },
    { id: "monitor-light", label: "Monitor · Light beam", create: () => (monitorLight()) },
    { id: "copier-volley", label: "Copier · Paper volley", create: () => (copierVolley()) },
    { id: "head-impact", label: "Chair · Head impact replay", create: () => (headImpact()) },
    { id: "focus-loss", label: "Chair · Focus loss", create: () => (focusLoss()) },
    { id: "focus-tension", label: "Chair · Focus tension", create: () => (focusTension()) },
    { id: "focus-hit-vignette", label: "Chair · Focus hit vignette", create: () => (focusHitVignette()) },
    { id: "rooftop-entrance", label: "Rooftop · Entrance & slipping portrait", create: () => (rooftopEntrance()) },
    { id: "personal-belongings", label: "Rooftop · Plant bow & badge farewell", create: () => (personalBelongings()) },
    { id: "extinguisher-spray", label: "Chair · Extinguisher recoil", create: () => (extinguisherSpray()) },
    { id: "duct-sneeze", label: "Rooftop · First timed sneeze & overtime junk", create: () => (ductSneeze()) },
    { id: "duct-gust", label: "Rooftop · Timed duct gust", create: () => (ductSneeze(true)) },
    { id: "rooftop-shaft-low", label: "Rooftop · Shaft duct gust & side vent", create: () => (shaftHazards('rooftop-shaft-low', 'Rooftop · Shaft duct gust & side vent', { x: 1420, y: 78 }, 0,
        [{ at: 1.6, label: 'Vent hiss' }, { at: 2.4, label: 'Vent blast' }, { at: 3.45, label: 'Duct inhale' }, { at: 4.05, label: 'Duct gust' }])) },
    { id: "rooftop-shaft-high", label: "Rooftop · Shaft vent & ceiling downdraft", create: () => (shaftHazards('rooftop-shaft-high', 'Rooftop · Shaft vent & ceiling downdraft', { x: 1400, y: -262 }, 1.2,
        [{ at: .3, label: 'Downdraft' }, { at: 1.5, label: 'Wall vent hiss' }, { at: 2.25, label: 'Wall vent blast' }, { at: 2.65, label: 'Ceiling hiss' }, { at: 3.4, label: 'Downdraft' }])) },
    { id: "orientation-cable", label: "Building · Orientation: hop the cables", create: () => (orientationRun('orientation-cable', 'Building · Orientation: hop the cables', 3570, 0, true, 420,
        [{ at: 0, label: 'Rule one' }, { at: 1.4, label: 'Chairs hop first' }, { at: 2, label: 'Rookie hops' }, { at: 3.6, label: 'Again' }])) },
    { id: "orientation-sleeper", label: "Building · Orientation: overtime sleepers", create: () => (orientationRun('orientation-sleeper', 'Building · Orientation: overtime sleepers', 4890, 3, true, 480,
        [{ at: 0, label: 'Shh' }, { at: 2.2, label: 'Hop the sleeping bag' }, { at: 3.7, label: 'Another one' }])) },
    { id: "orientation-rhythm", label: "Building · Orientation: back to back after the flag", create: () => (orientationRun('orientation-rhythm', 'Building · Orientation: back to back after the flag', 6150, 6, true, 540,
        [{ at: 1.2, label: 'Two cables' }, { at: 3.6, label: 'Sleeper, cable' }, { at: 5.5, label: 'Three cables' }])) },
    { id: "orientation-finale", label: "Building · Orientation: sleeper pair and the last mix", create: () => (orientationRun('orientation-finale', 'Building · Orientation: sleeper pair and the last mix', 7900, 6, true, 360,
        [{ at: .8, label: 'Two sleepers' }, { at: 3, label: 'Cable, sleeper, cable' }])) },
    { id: "orientation-trip", label: "Building · Orientation: rookie trips", create: () => (orientationRun('orientation-trip', 'Building · Orientation: rookie trips', 3570, 0, false, 480,
        [{ at: 2, label: 'Trip on the cable' }, { at: 2.2, label: 'Rookie down!' }, { at: 3.7, label: 'Chairs wait' }])) },
    { id: "express-ramp", label: "Building · Express: jump from the ramp", create: () => (expressRun('express-ramp', 'Building · Express: jump from the ramp', true,
        [{ at: 1.5, label: 'Ramp shout' }, { at: 2.6, label: 'Jump at the lip' }])) },
    { id: "express-ramp-miss", label: "Building · Express: miss the ramp jump", create: () => (expressRun('express-ramp-miss', 'Building · Express: miss the ramp jump', false,
        [{ at: 1.5, label: 'Ramp shout' }, { at: 2.8, label: 'Missed jump' }])) },
    { id: "urgent-copier-low", label: "Office · Urgent reports: skimming sheets", create: () => (urgentCopier(1, 'urgent-copier-low', 'Office · Urgent reports: skimming sheets')) },
    { id: "urgent-copier-lob", label: "Office · Urgent reports: lobbed sheets", create: () => (urgentCopier(2, 'urgent-copier-lob', 'Office · Urgent reports: lobbed sheets')) },
    { id: "urgent-copier-fan", label: "Office · Urgent reports: both at once", create: () => (urgentCopier(3, 'urgent-copier-fan', 'Office · Urgent reports: both at once')) },
    { id: "urgent-copier-bundle", label: "Office · Urgent reports: stapled bundle", create: () => (urgentCopier(4, 'urgent-copier-bundle', 'Office · Urgent reports: stapled bundle')) },
    { id: "rooftop-takeoff", label: "Rooftop · Sales graph ride & bread cloud ascent", create: () => (rooftopTakeoff()) },
    { id: "cloud-entry", label: "Sky · Stage 4 bread clouds", create: () => (cloudEntry()) },
    { id: "sky-gust", label: "Sky · Headwind gust, paper bundles, parrots, rocking desks", create: () => (skyGustCycle()) },
    { id: "sky-gear", label: "Sky · Floating monitor, keyboard, mouse and tower PC", create: () => (skyOfficeGear()) },
    { id: "sky-facade", label: "Sky · Floating office facade and its workers", create: () => (skyOfficeFacade()) },
    { id: "sky-wind-feedback", label: "Sky · Open-air wind response (spray held)", create: () => (skyWindFeedback()) },
    { id: "sky-parrots", label: "Sky · Parrot colours (one bird per pass)", create: () => (skyParrots()) },
    { id: "sky-robot-parrot", label: "Sky · Robot parrots (liquid metal, black chrome) and gear knock", create: () => (skyRobotParrot()) },
    { id: "sky-sign-depth", label: "Sky · Chair and parrot pass in front of the billboard copy", create: () => (skySignDepth()) },
    { id: "sky-promotion-cake", label: "Sky · Promotion shortcake on the final desk", create: () => (skyPromotionCake()) },
    { id: "sky-ending", label: "Sky · Slow turn among cameras, glide into stage 5 at cruise speed", create: () => (skyEnding()) },
    { id: "sky-to-orbit", label: "Sky → Orbit · Hand-off, steering fade-in, flying on by itself", create: () => (skyToOrbit()) },
    { id: "orbit-route", label: "Orbit · 5-1 to 5-3 and the ending", create: () => (orbitRoute()) },
    { id: "orbit-satellite-light", label: "Orbit · 5-1: the first beam, announced then dodged", create: () => (orbitSatelliteLightScene()) },
    { id: "orbit-satellite-light-lit", label: "Orbit · The chair lights up near and inside a satellite light", create: () => (orbitSatelliteLightLitScene()) },
    { id: "orbit-ending", label: "Orbit · Ending: network lost on screen, hands stop, the chair looks out, THE END", create: () => (orbitEndingScene()) },
    { id: "orbit-ending-aside", label: "Orbit · Ending after parking off to one side", create: () => (orbitEndingScene(true)) },
    { id: "building-meeting", label: "Building · The chairs cannot clock out", create: () => (meetingVisit()) },
    { id: "building-meeting-2", label: "Building · The chairs cannot clock out (visit 2)", create: () => (meetingVisit(2)) },
    { id: "building-meeting-3", label: "Building · The chairs cannot clock out (visit 3)", create: () => (meetingVisit(3)) },
    { id: "building-dispatch", label: "Building · Chairs leave after the first flag", create: () => (chairDispatch()) },
    { id: "office-typing", label: "Office · Window typing", create: () => (officeTyping()) }
];
