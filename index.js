'﻿use strict';

const { distance, wgs_gcj, gcj_wgs, gcj_bd, bd_gcj, wgs_bd, bd_wgs, gcj_wgs_bored, bd_gcj_bored, bd_wgs_bored } = require('prcoords');
const { OpenLocationCode } = require('open-location-code');
const { isInBaidu, isInGoogle } = require('./insane_is_in_china.js');

// 坐标转换精度测试
// 每个 Array 中 [0] 表示转换后的纬度，[1] 表示转换后的经度，[2] 表示转换前后的距离（米），[3] 表示来回转换与原坐标的距离（米）
// 其中 [3] 可以反映精度
const deltaTest = (lat, lon, bored = true) => {
    let input = { lat: lat, lon: lon };
    const handle = (fwd, rev) => {
        let result_fwd = fwd(input, false);
        let result_rev = rev(result_fwd, false);
        return [result_fwd.lat, result_fwd.lon, distance(input, result_fwd), distance(input, result_rev)];
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

// 短 OLC 还原
// 当中 gcj 为 true 则认为输入的临近坐标为 GCJ-02，否则为 WGS-84
// 若输入为 WGS-84，只有坐标位于中国才转为 GCJ-02
const recoverOLC = (olc, lat, lon, gcj = true) => {
    let near = !gcj && isInGoogle(lat, lon) ? wgs_gcj({ lat: lat, lon: lon }, false) : { lat: lat, lon: lon };
    return new OpenLocationCode().recoverNearest(olc, near.lat, near.lon);
};

// OLC 转 GCJ-02
// 中国以外地区为 WGS-84
const olc2gcj = (olc, lat, lon, gcj = true) => {
    let fullOLC = recoverOLC(olc, lat, lon, gcj);
    let coord = new OpenLocationCode().decode(fullOLC);
    return { lat: coord.latitudeCenter, lon: coord.longitudeCenter };
};

// OLC 转 WGS-84
// 当中 wgs 为 true 则认为输入的临近坐标为 WGS-84，否则为 GCJ-02
// 只有坐标位于中国才转换
const olc2wgs = (olc, lat, lon, wgs = true) => {
    let gcj = olc2gcj(olc, lat, lon, !wgs);
    return isInGoogle(gcj.lat, gcj.lon) ? gcj_wgs_bored(gcj) : gcj;
};

module.exports = {
    deltaTest,
    recoverOLC,
    olc2gcj,
    olc2wgs,
};
