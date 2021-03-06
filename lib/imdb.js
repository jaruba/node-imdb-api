"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var util_1 = require("./util");
var interfaces_1 = require("./interfaces");
var es6promise = require("es6-promise");
var rp = require("request-promise");
var Promise = es6promise.Promise;
var omdbapi = "https://www.omdbapi.com/";
var trans_table = new util_1.Inverter({
    "genres": "Genre",
    "languages": "Language",
    "votes": "imdbVotes",
    "rating": "imdbRating"
});
var Episode = (function () {
    function Episode(obj, season) {
        this.season = season;
        for (var attr in obj) {
            if (attr === "Released") {
                var _a = obj[attr].split("-"), year = _a[0], month = _a[1], day = _a[2];
                this.released = new Date(parseInt(year), parseInt(month), parseInt(day));
            }
            else if (attr === "Rating") {
                this[attr.toLowerCase()] = parseFloat(obj[attr]);
            }
            else if (attr === "Episode" || attr === "Season") {
                this[attr.toLowerCase()] = parseInt(obj[attr]);
            }
            else if (attr === "Title") {
                this.name = obj[attr];
            }
            else if (obj.hasOwnProperty(attr) && trans_table.get(attr) !== undefined) {
                this[trans_table.get(attr)] = obj[attr];
            }
            else if (obj.hasOwnProperty(attr)) {
                this[attr.toLowerCase()] = obj[attr];
            }
        }
    }
    return Episode;
}());
exports.Episode = Episode;
var Movie = (function () {
    function Movie(obj) {
        for (var attr in obj) {
            if (attr === "year" || attr.toLowerCase() === "year") {
                this["_year_data"] = obj[attr];
                if (!obj[attr].match(/\d{4}[\-–]\d{4}/)) {
                    this[attr.toLowerCase()] = parseInt(obj[attr]);
                }
            }
            else if (attr === "Released") {
                this.released = new Date(obj[attr]);
            }
            else if (attr === "Rating") {
                this[attr.toLowerCase()] = parseFloat(obj[attr]);
            }
            else if (attr === "Ratings") {
                if ((!this['tomatoMeter'] || this['tomatoMeter'] == 'N/A') && obj['Ratings'] && obj['Ratings'].length) {
                    var that = {};
                    var foundSomething = obj['Ratings'].some(function (ratingEl) {
                        if (ratingEl['Source'] == 'Rotten Tomatoes' && ratingEl['Value'] && ratingEl['Value'] != 'N/A') {
                            that['tomatoMeter'] = ratingEl['Value'];
                            var meter = parseInt(that['tomatoMeter']);
                            that['tomatoImage'] = meter > 84 ? 'certified' : meter > 49 ? 'fresh' : 'rotten';
                            return true;
                        }
                    });
                    if (foundSomething) {
                        this['tomatoMeter'] = that['tomatoMeter'];
                        this['tomatoImage'] = that['tomatoImage'];
                    }
                }
            }
            else if (obj.hasOwnProperty(attr) && trans_table.get(attr) !== undefined) {
                this[trans_table.get(attr)] = obj[attr];
            }
            else if (obj.hasOwnProperty(attr)) {
                this[attr.toLowerCase()] = obj[attr];
            }
            else if (attr.indexOf("tomato") == 0) {
                if (!this[attr]) {
                    this[attr] = obj[attr];
                }
            }
        }
        this.series = this.type === "movie" ? false : true;
        this.imdburl = "https://www.imdb.com/title/" + this.imdbid;
    }
    return Movie;
}());
exports.Movie = Movie;
var TVShow = (function (_super) {
    __extends(TVShow, _super);
    function TVShow(object) {
        var _this = _super.call(this, object) || this;
        _this._episodes = [];
        var years = _this["_year_data"].split("-");
        _this.start_year = parseInt(years[0]) ? parseInt(years[0]) : null;
        _this.end_year = parseInt(years[1]) ? parseInt(years[1]) : null;
        _this.totalseasons = parseInt(_this["totalseasons"]);
        return _this;
    }
    TVShow.prototype.episodes = function (cb) {
        if (this._episodes.length !== 0) {
            return cb(undefined, this._episodes);
        }
        var tvShow = this;
        var funcs = [];
        for (var i = 1; i <= tvShow.totalseasons; i++) {
            funcs.push(rp({ "qs": { "i": tvShow.imdbid, "tomatoes": "true", "r": "json", "Season": i, "apikey": process.env["omdb_key"] }, "json": true, "url": omdbapi }));
        }
        var prom = Promise.all(funcs)
            .then(function (ep_data) {
            var eps = [];
            for (var key in ep_data) {
                var datum = ep_data[key];
                if (interfaces_1.isError(datum)) {
                    var err = new ImdbError(datum.Error, undefined);
                    if (cb) {
                        return cb(err, undefined);
                    }
                    return Promise.reject(err);
                }
                else {
                    var season = parseInt(datum.Season);
                    for (var ep in datum.Episodes) {
                        eps.push(new Episode(datum.Episodes[ep], season));
                    }
                }
            }
            tvShow._episodes = eps;
            if (cb) {
                return cb(undefined, eps);
            }
            return Promise.resolve(eps);
        });
        if (cb) {
            prom["catch"](function (err) {
                return cb(err, undefined);
            });
        }
        else {
            return prom;
        }
    };
    return TVShow;
}(Movie));
exports.TVShow = TVShow;
var ImdbError = (function () {
    function ImdbError(message, movie) {
        this.message = message;
        this.movie = movie;
        this.name = "imdb api error";
    }
    return ImdbError;
}());
exports.ImdbError = ImdbError;
function getReq(req, cb) {
    var responseData = "";
    var qs = { plot: "full", r: "json", y: req.year, tomatoes: "true" };
    if (req.name) {
        qs["t"] = req.name;
    }
    else if (req.id) {
        qs["i"] = req.id;
    }
    if (process.env["omdb_key"]) {
        qs["apikey"] = process.env["omdb_key"];
    }
    var prom = rp({ "qs": qs, url: omdbapi, json: true }).then(function (data) {
        var ret;
        if (interfaces_1.isError(data)) {
            var err = new ImdbError(data.Error + ": " + (req.name ? req.name : req.id), req);
            if (cb) {
                return cb(err, undefined);
            }
            else {
                return Promise.reject(err);
            }
        }
        else {
            if (interfaces_1.isMovie(data)) {
                ret = new Movie(data);
            }
            else if (interfaces_1.isTvshow(data)) {
                ret = new TVShow(data);
            }
            else if (interfaces_1.isEpisode(data)) {
                ret = new Episode(data, 30);
            }
            else {
                var err = new ImdbError("type: " + data.Type + " not valid", req);
                if (cb) {
                    return cb(err, undefined);
                }
                else {
                    return Promise.reject(err);
                }
            }
            if (cb) {
                return cb(undefined, ret);
            }
            return Promise.resolve(ret);
        }
    });
    if (cb) {
        prom["catch"](function (err) {
            cb(err, undefined);
        });
    }
    else {
        return prom;
    }
}
exports.getReq = getReq;
function get(name, cb) {
    return getReq({ id: undefined, name: name }, cb);
}
exports.get = get;
function getById(imdbid, cb) {
    return getReq({ id: imdbid, name: undefined }, cb);
}
exports.getById = getById;
//# sourceMappingURL=imdb.js.map