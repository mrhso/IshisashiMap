'use strict';

const prcoords = require('prcoords');
const { OpenLocationCode } = require('open-location-code');
const insane = require('./insane_is_in_china.js');
const https = require('https');

const isNumber = (arg) => Object.prototype.toString.call(arg) === '[object Number]';
const round = (num, pow) => isNumber(pow) ? Math.sign(num) * Math.round(Math.abs(num) * Number(`1e${pow}`)) / Number(`1e${pow}`) : num;
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

        // Wait till we hit fixed point or get bored
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

        // 通过舍入寻找更合理的解
        const getDigit = (num) => {
            let str = num.toString();
            let part = str.split('e');
            if (part[1]) {
                let pow = Number(part[1]);
                if (pow < 0) {
                    return -pow;
                };
            } else {
                part = str.split('.');
                if (part[1]) {
                    return part[1].length;
                };
            };
            return 0;
        };
        const coordsDigit = (coords) => Math.max(getDigit(coords.lat), getDigit(coords.lon));
        let pre = minDiffCurr;
        diff = minDiff;
        curr = minDiffCurr;
        let digit = coordsDigit(pre);
        let minDigit = digit;
        i = 0;
        while (i++ < digit) {
            curr = coordsRound(pre, i);
            diff = _coord_diff(fwd(curr, false), heck);
            if (Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) === Math.max(Math.abs(minDiff.lat), Math.abs(minDiff.lon)) && i < minDigit || Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) < Math.max(Math.abs(minDiff.lat), Math.abs(minDiff.lon))) {
                minDiff = diff;
                minDiffCurr = curr;
                minDigit = i;
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

// 百度地图坐标转换 API
// 用于测试 PRCoords 的算法，不建议直接使用
const baiduGeoconv = (coords, from, to, ak, callback) => {
    https.get(new URL(`https://api.map.baidu.com/geoconv/v1/?coords=${coords.lon},${coords.lat}&from=${from}&to=${to}&ak=${ak}`), (res) => {
        let chunks = [];
        res.on('data', (chunk) => {
            chunks.push(chunk);
        });
        res.on('end', () => {
            let chunk = JSON.parse(Buffer.concat(chunks).toString());
            if (chunk.result) {
                callback({ lat: chunk.result[0].y, lon: chunk.result[0].x });
            };
        });
    });
};

// 高德地图坐标转换 API
// 用于测试 PRCoords 的算法，不建议直接使用
const amapConvert = (coords, coordsys, key, callback) => {
    https.get(new URL(`https://restapi.amap.com/v3/assistant/coordinate/convert?locations=${coords.lon},${coords.lat}&coordsys=${coordsys}&key=${key}`), (res) => {
        let chunks = [];
        res.on('data', (chunk) => {
            chunks.push(chunk);
        });
        res.on('end', () => {
            let chunk = JSON.parse(Buffer.concat(chunks).toString());
            if (chunk.locations) {
                callback({ lat: Number(chunk.locations.split(',')[1]), lon: Number(chunk.locations.split(',')[0]) });
            };
        });
    });
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
    baiduGeoconv,
    amapConvert,
    latlon2webmct,
    webmct2latlon,
    isInBaidu,
    isInGoogle,
};
