var Immutable = require('immutable');

module.exports = function() {
    function get(a) {
        return Immutable.Map.isMap(a) ? a.getIn(arguments.slice(1)) :
               undefined;
    }
    function getIn(a,b) {
        return Immutable.Map.isMap(a) ? a.getIn(b) : undefined;
    }
    function isSpecial(a) {
        if(a.getIn) return a.getIn(["",0]);
        if(a[""] && Object.keys(a).length == 1)
            return a[""][0];
        return undefined;
    };
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
            return {"":["UUID",a]};
        },
        asUUIDString: function(a) {
            return (isSpecial(a) == "UUID") ? (a.getIn ? a.getIn(["",1]) : a[""][1]) : undefined;
        },
        asNumber: function(a) {
            return x === null ? NaN : +a; //was: Number(a);
        },
        asString: function(a) {
            return (typeof(a) == "string") ? a : (""+a);
        },
    }
    vsmf.getIn = getIn;
    vsmf.get = get;
    vsmf.isSpecial = isSpecial;
    vsmf.Immutable = Immutable
    return vsmf;
}();

