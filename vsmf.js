const Immutable = require('immutable');

module.exports = function() {
    function get(a) {
        //this is not very efficient
        return Immutable.Map.isMap(a) ? a.getIn(Array.prototype.slice.call(arguments,1)) :
               undefined;
    }
    function getIn(a,b) {
        return Immutable.Map.isMap(a) ? a.getIn(b) : undefined;
    }
    function isSpecial(a) {
        if(a.getIn && a.size == 1) return a.getIn(["",0]);
        if(a[""] && Object.keys(a).length == 1)
            return a[""][0];
        return undefined;
    };
    function asString(a) {
        return (typeof(a) == "string") ? a : (""+a);
    }
    var vsmf = {
        isEForm: function(a) {
            return Immutable.Map.isMap(a) && !isSpecial(a);
        },
        isList: function(a) {
            return Immutable.List.isList(a) || Array.isArray(a);
        },
        isUUID: function(a) {
            return (isSpecial(a) == "UUID");
        },
        isString: function(a) {
            return (typeof(a) == "string");
        },
        isNumber: function(a) {
            return (typeof(a) == "number");
        },
        toUUID: function(a) {
            return Immutable.fromJS({"":["UUID",asString(a)]});
        },
        asUUIDString: function(a) {
            return (isSpecial(a) == "UUID") ? (a.getIn ? a.getIn(["",1]) : a[""][1]) : undefined;
        },
        asNumber: function(a) {
            return x === null ? NaN : +a; //was: Number(a);
        },
        asString: asString,
        getIn: getIn,
        get: get,
        isSpecial: isSpecial,
        Immutable: Immutable
    }
    return vsmf;
}();

