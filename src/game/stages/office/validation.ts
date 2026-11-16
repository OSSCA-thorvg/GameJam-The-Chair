import {
    exactFields,
    record,
    exact,
    array,
    finite,
    integer,
    boolean,
    paper,
} from '../../validation/primitives';

import type { OfficeState } from './state';

export function office(value: unknown, path: string): void {
    const data = record(value, path);
    exactFields<OfficeState>(
        data,
        {
            copier: true,
            urgent: true,
            papers: true,
            paperHits: true,
            paperPenaltyRemaining: true,
            cleaning: true,
            bucket: true,
            soakedOnSpill: true,
            slip: true,
            wetSeen: true,
            slipCooldown: true,
            inBin: true,
            dirty: true,
            binAge: true,
            binCooldown: true,
            binFalls: true,
            lightPenaltyRemaining: true,
            lightHits: true,
            lightCooldown: true,
            doorHits: true,
        },
        path,
    );
    const copier = record(data.copier, `${path}.copier`);
    exact(
        copier,
        ['x', 'cool', 'burst', 'next', 'dir', 'volley', 'bursts'],
        `${path}.copier`,
    );
    for (const key of ['x', 'cool', 'burst', 'next', 'dir']) {
        finite(copier[key], `${path}.copier.${key}`);
    }
    for (const key of ['volley', 'bursts']) {
        integer(copier[key], `${path}.copier.${key}`);
    }
    const urgent = record(data.urgent, `${path}.urgent`);
    exact(
        urgent,
        ['x', 'scan', 'cool', 'burst', 'next', 'dir', 'volley'],
        `${path}.urgent`,
    );
    for (const key of ['x', 'scan', 'cool', 'next', 'dir']) {
        finite(urgent[key], `${path}.urgent.${key}`);
    }
    for (const key of ['burst', 'volley']) {
        integer(urgent[key], `${path}.urgent.${key}`);
    }
    for (const key of [
        'paperHits',
        'soakedOnSpill',
        'binFalls',
        'lightHits',
        'doorHits',
    ]) {
        integer(data[key], `${path}.${key}`);
    }
    for (const key of [
        'paperPenaltyRemaining',
        'slipCooldown',
        'binAge',
        'binCooldown',
        'lightPenaltyRemaining',
        'lightCooldown',
    ]) {
        finite(data[key], `${path}.${key}`);
    }
    for (const key of ['slip', 'wetSeen', 'inBin', 'dirty']) {
        boolean(data[key], `${path}.${key}`);
    }
    array(data.papers, `${path}.papers`, 60).forEach((item, index) =>
        paper(item, `${path}.papers[${index}]`),
    );

    const cleaning = record(data.cleaning, `${path}.cleaning`);
    exact(
        cleaning,
        ['x', 'a', 'b', 'spilled', 'age', 'followup', 'splashDir'],
        `${path}.cleaning`,
    );
    for (const key of ['x', 'a', 'b', 'age', 'splashDir']) {
        finite(cleaning[key], `${path}.cleaning.${key}`);
    }
    for (const key of ['spilled', 'followup']) {
        boolean(cleaning[key], `${path}.cleaning.${key}`);
    }
    const bucket = record(data.bucket, `${path}.bucket`);
    exact(bucket, ['age', 'armed', 'spills'], `${path}.bucket`);
    finite(bucket.age, `${path}.bucket.age`);
    boolean(bucket.armed, `${path}.bucket.armed`);
    integer(bucket.spills, `${path}.bucket.spills`);
}
