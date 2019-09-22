'use strict';

const prcoords = require('prcoords');
const { OpenLocationCode } = require('open-location-code');
const { isInGoogle } = require('./insane_is_in_china.js');
const https = require('https');

const wgs_gcj = (wgs, checkChina = true) => checkChina && !isInGoogle(wgs.lat, wgs.lon) ? (console.warn(`Non-Chinese coords found, returning as-is: (${wgs.lat}, ${wgs.lon})`), wgs) : prcoords.wgs_gcj(wgs, false);
const gcj_wgs = (gcj, checkChina = true) => checkChina && !isInGoogle(gcj.lat, gcj.lon) ? (console.warn(`Non-Chinese coords found, returning as-is: (${gcj.lat}, ${gcj.lon})`), gcj) : prcoords.gcj_wgs(gcj, false);

const gcj_bd = prcoords.gcj_bd;
const bd_gcj = prcoords.bd_gcj;

const wgs_bd = (bd, checkChina = true) => gcj_bd(wgs_gcj(bd, checkChina));
const bd_wgs = (bd, checkChina = true) => gcj_wgs(bd_gcj(bd), checkChina);

const round = (num, pow = 0) => Math.sign(num) * Math.round(Math.abs(num) * Number(`1e${pow}`)) / Number(`1e${pow}`);
const coordRound = (coord, pow = 0) => ({ lat: round(coord.lat, pow), lon: round(coord.lon, pow) });

const __bored__ = (fwd, rev) => {
    const _coord_diff = (a, b) => ({ lat: a.lat - b.lat, lon: a.lon - b.lon });

    // eps 表示所求精度，maxTimes 表示最大迭代次数
    return (heck, checkChina = true, eps = Number.EPSILON, maxTimes = 15) => {
        let curr = rev(heck, checkChina);
        let diff = { lat: Infinity, lon: Infinity };
        let minDiffCurr = curr;
        let minDiff = diff;

        // Wait till we hit fixed point or get bored
        let i = 0;
        while (Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) > eps && i++ < maxTimes) {
            diff = _coord_diff(fwd(curr, checkChina), heck);
            curr = _coord_diff(curr, diff);
            // 有时运气不好会卡在高频的阴沟里，所以选择误差最小的那个吧
            if (Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) < Math.max(Math.abs(minDiff.lat), Math.abs(minDiff.lon))) {
                minDiff = diff;
                minDiffCurr = curr;
            };
        };

        // 通过舍入寻找更合理的解
        const getDigit = (coord) => Math.max(Number(coord.lat.toExponential().split('e')[1]), Number(coord.lon.toExponential().split('e')[1]));
        let pre = minDiffCurr;
        diff = minDiff;
        curr = minDiffCurr;
        let digit = getDigit(pre);
        let minDigit = digit;
        i = 0;
        while (Math.max(i++ < digit) {
            curr = coordRound(pre, i);
            diff = _coord_diff(fwd(curr, checkChina), heck);
            if (Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) === Math.max(Math.abs(minDiff.lat), Math.abs(minDiff.lon)) && digit < minDigit || Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) < Math.max(Math.abs(minDiff.lat), Math.abs(minDiff.lon))) {
                minDiff = diff;
                minDiffCurr = curr;
                minDidigit = digit;
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
const deltaTest = (coord, bored = true, eps = Number.EPSILON, maxTimes = 15) => {
    const handle = (fwd, rev) => {
        let result_fwd = fwd(coord, false, eps, maxTimes);
        let result_rev = rev(result_fwd, false, eps, maxTimes);
        return [result_fwd, result_rev, prcoords.distance(coord, result_fwd), prcoords.distance(coord, result_rev)];
    };
    return {
        raw: [coord, coord, 0, 0],
        wgs_gcj: handle(wgs_gcj, bored ? gcj_wgs_bored : gcj_wgs),
        wgs_bd: handle(wgs_bd, bored ? bd_wgs_bored : bd_wgs),
        gcj_wgs: handle(bored ? gcj_wgs_bored : gcj_wgs, wgs_gcj),
        bd_wgs: handle(bored ? bd_wgs_bored : bd_wgs, wgs_bd),
        gcj_bd: handle(gcj_bd, bored ? bd_gcj_bored : bd_gcj),
        bd_gcj: handle(bored ? bd_gcj_bored : bd_gcj, gcj_bd),
    };
};

// OLC 转坐标
const olc2coord = (olc, near) => {
    let fullOLC = new OpenLocationCode().recoverNearest(olc, near.lat, near.lon);
    let coord = new OpenLocationCode().decode(fullOLC);
    return { lat: coord.latitudeCenter, lon: coord.longitudeCenter };
};

// 百度地图坐标转换 API
// 用于测试 PRCoords 的算法，不建议直接使用
const baiduGeoconv = (coord, from, to, ak, callback) => {
    https.get(new URL(`https://api.map.baidu.com/geoconv/v1/?coords=${coord.lon},${coord.lat}&from=${from}&to=${to}&ak=${ak}`), (res) => {
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
const amapConvert = (coord, coordsys, key, callback) => {
    https.get(new URL(`https://restapi.amap.com/v3/assistant/coordinate/convert?locations=${coord.lon},${coord.lat}&coordsys=${coordsys}&key=${key}`), (res) => {
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

const lonlat2webmct = (coord) => ({ x: (Math.PI / 180) * 6378137 * coord.lon, y: 6378137 * Math.log(Math.tan(Math.PI / 4 + (Math.PI / 180) * coord.lat / 2)) });
const webmct2lonlat = (coord) => ({ lat: (180 / Math.PI) * 2 * Math.atan(Math.exp(coord.y / 6378137)) - 90, lon: (180 / Math.PI) * coord.x / 6378137 });

module.exports = {
    coordRound,
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
    olc2coord,
    baiduGeoconv,
    amapConvert,
    lonlat2webmct,
    webmct2lonlat,
};
