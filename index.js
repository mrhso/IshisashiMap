'﻿use strict';

const prcoords = require('prcoords');
const { OpenLocationCode } = require('open-location-code');
const { isInGoogle } = require('./insane_is_in_china.js');
const https = require('https');

const wgs_gcj = (wgs, checkChina = true) => {
    if (checkChina && !isInGoogle(wgs.lat, wgs.lon)) {
        return wgs;
    } else {
        return prcoords.wgs_gcj(wgs, false);
    };
};

const gcj_wgs = (gcj, checkChina = true) => {
    if (checkChina && !isInGoogle(gcj.lat, gcj.lon)) {
        return gcj;
    } else {
        return prcoords.gcj_wgs(gcj, false);
    };
};

const gcj_bd = prcoords.gcj_bd;
const bd_gcj = prcoords.bd_gcj;

const wgs_bd = (bd, checkChina = true) => {
    return gcj_bd(wgs_gcj(bd, checkChina));
};

const bd_wgs = (bd, checkChina = true) => {
    return gcj_wgs(bd_gcj(bd), checkChina);
};

// TODO 极端情况
// 在纬度极高的情况下，经度偏移急剧增大，导致局部线性失效
const __bored__ = (fwd, rev) => {
    return (heck, checkChina = true) => {
        if (Math.abs(heck.lat) < 89) {
            let curr = rev(heck, checkChina);
            let diff = { lat: Infinity, lon: Infinity };

            let i = 0;
            while (Math.max(Math.abs(diff.lat), Math.abs(diff.lon)) > PRC_EPS && i++ < 10) {
                diff = _coord_diff(fwd(curr, checkChina), heck);
                curr = _coord_diff(curr, diff);
            };

            return curr;
        };
    } else {
        // ????
    };
};

const gcj_wgs_bored = __bored__(wgs_gcj, gcj_wgs);
const bd_gcj_bored = __bored__(gcj_bd, bd_gcj);
const bd_wgs_bored = __bored__(wgs_bd, bd_wgs);

// 坐标转换精度测试
// 每个 Array 中 [0] 表示转换后的纬度，[1] 表示转换后的经度，[2] 表示转换前后的距离（米），[3] 表示来回转换与原坐标的距离（米）
// 其中 [3] 可以反映精度
const deltaTest = (coord, bored = true) => {
    const handle = (fwd, rev) => {
        let result_fwd = fwd(coord, false);
        let result_rev = rev(result_fwd, false);
        return [result_fwd.lat, result_fwd.lon, prcoords.distance(coord, result_fwd), prcoords.distance(coord, result_rev)];
    };
    return {
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
