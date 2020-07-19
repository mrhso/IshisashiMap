'use strict';

const prcoords = require('prcoords');
const { OpenLocationCode } = require('open-location-code');
const insane = require('./insane_is_in_china.js');
const https = require('https');

const round = (num, pow) => (pow === undefined || pow === null || pow === false) ? num : Math.sign(num) * Math.round(Math.abs(num) * Number(`1e${pow}`)) / Number(`1e${pow}`);
const coordsRound = (coords, pow) => ({ lat: round(coords.lat, pow), lon: round(coords.lon, pow) });

const isInBaidu = (coords) => insane.isInBaidu(coords.lat, coords.lon);
const isInGoogle = (coords) => insane.isInGoogle(coords.lat, coords.lon);

const wgs_gcj = (wgs, checkChina = true) => checkChina && !isInGoogle(wgs) ? (console.warn(`Non-Chinese coords found, returning as-is: (${wgs.lat}, ${wgs.lon})`), wgs) : prcoords.wgs_gcj(wgs, false);
const gcj_wgs = (gcj, checkChina = true) => checkChina && !isInGoogle(gcj) ? (console.warn(`Non-Chinese coords found, returning as-is: (${gcj.lat}, ${gcj.lon})`), gcj) : prcoords.gcj_wgs(gcj, false);

const gcj_bd = (gcj, checkChina = true) => checkChina && !isInGoogle(gcj) ? (console.warn(`Non-Chinese coords found, returning as-is: (${gcj.lat}, ${gcj.lon})`), gcj) : prcoords.gcj_bd(gcj);
const bd_gcj = (bd, checkChina = true) => checkChina && !isInGoogle(bd) ? (console.warn(`Non-Chinese coords found, returning as-is: (${bd.lat}, ${bd.lon})`), bd) : prcoords.bd_gcj(bd);

const wgs_bd = (bd, checkChina = true) => checkChina && !isInGoogle(bd) ? (console.warn(`Non-Chinese coords found, returning as-is: (${bd.lat}, ${bd.lon})`), bd) : prcoords.wgs_bd(bd, false);
const bd_wgs = (bd, checkChina = true) => checkChina && !isInGoogle(bd) ? (console.warn(`Non-Chinese coords found, returning as-is: (${bd.lat}, ${bd.lon})`), bd) : prcoords.bd_wgs(bd, false);

const __bored__ = (fwd, rev) => {
    const _coord_diff = (a, b) => ({ lat: a.lat - b.lat, lon: a.lon - b.lon });

    // eps 表示所求精度，maxTimes 表示最大迭代次数
    return (heck, checkChina = true, eps = Number.EPSILON, maxTimes = 20) => {
        if (checkChina && !isInGoogle(heck)) {
            console.warn(`Non-Chinese coords found, returning as-is: (${heck.lat}, ${heck.lon})`);
            return heck;
        };

        let curr = rev(heck, false);
        let diff = { lat: Infinity, lon: Infinity };
        let minDiffCurr = curr;
        let minDiff = diff;

        // 来吧，直到达到要求的那一刻……
        let i = 0;
        while (Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) >= eps && i++ < maxTimes) {
            diff = _coord_diff(fwd(curr, false), heck);
            curr = _coord_diff(curr, diff);
            // 有时运气不好会卡在高频的阴沟里，所以选择误差最小的那个吧
            if (Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) < Math.max(Math.abs(minDiff.lat), Math.abs(minDiff.lon))) {
                minDiff = diff;
                minDiffCurr = curr;
            };
        };

        return minDiffCurr;
    };
};

const gcj_wgs_bored = __bored__(wgs_gcj, gcj_wgs);
const bd_gcj_bored = __bored__(gcj_bd, bd_gcj);
const bd_wgs_bored = __bored__(wgs_bd, bd_wgs);

// 坐标转换精度测试
// 每个 Array 中 [0] 表示转换后的坐标，[1] 表示来回转换后的坐标，[2] 表示转换前后的距离（米），[3] 表示来回转换与原坐标的距离（米）
// 其中 [3] 可以反映精度
const deltaTest = (coords, bored = true, eps = Number.EPSILON, maxTimes = 20, inputRound, outputRound) => {
    coords = coordsRound(coords, inputRound);
    const handle = (fwd, rev) => {
        let result_fwd = coordsRound(fwd(coords, false, eps, maxTimes), outputRound);
        let result_rev = coordsRound(rev(result_fwd, false, eps, maxTimes), inputRound);
        return [result_fwd, result_rev, prcoords.distance(coords, result_fwd), prcoords.distance(coords, result_rev)];
    };
    return {
        raw: [coords, coords, 0, 0],
        wgs_gcj: handle(wgs_gcj, bored ? gcj_wgs_bored : gcj_wgs),
        wgs_bd: handle(wgs_bd, bored ? bd_wgs_bored : bd_wgs),
        gcj_wgs: handle(bored ? gcj_wgs_bored : gcj_wgs, wgs_gcj),
        bd_wgs: handle(bored ? bd_wgs_bored : bd_wgs, wgs_bd),
        gcj_bd: handle(gcj_bd, bored ? bd_gcj_bored : bd_gcj),
        bd_gcj: handle(bored ? bd_gcj_bored : bd_gcj, gcj_bd),
    };
};

// OLC 转坐标
const olc2coords = (olc, near) => {
    let fullOLC = new OpenLocationCode().recoverNearest(olc, near.lat, near.lon);
    let coords = new OpenLocationCode().decode(fullOLC);
    return { lat: coords.latitudeCenter, lon: coords.longitudeCenter };
};

const latlon2webmct = (coords) => ({ x: (Math.PI / 180) * 6378137 * coords.lon, y: 6378137 * Math.log(Math.tan(Math.PI / 4 + (Math.PI / 180) * coords.lat / 2)) });
const webmct2latlon = (coords) => ({ lat: (180 / Math.PI) * 2 * Math.atan(Math.exp(coords.y / 6378137)) - 90, lon: (180 / Math.PI) * coords.x / 6378137 });

module.exports = {
    coordsRound,
    wgs_gcj,
    gcj_wgs,
    gcj_bd,
    bd_gcj,
    wgs_bd,
    bd_wgs,
    __bored__,
    gcj_wgs_bored,
    bd_gcj_bored,
    bd_wgs_bored,
    deltaTest,
    olc2coords,
    latlon2webmct,
    webmct2latlon,
    isInBaidu,
    isInGoogle,
};
