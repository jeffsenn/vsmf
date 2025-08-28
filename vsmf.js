function require_optional(m) {
    let ret = null;
    try {
        ret = require("immutable");
    } catch (err) {
        if (err.code != "MODULE_NOT_FOUND") {
            throw err;
        }
    }
    return ret;
}
const Immutable = require_optional('immutable');

module.exports = function() {
    function immute(a, doit=true, frez=false) {
        if(frez && typeof(a) === "object") Object.freeze();
        return doit ? Immutable.fromJS(a) : a;
    }
    function hexToUint8Array(hex) {
        if (hex.length % 2 !== 0) {
            throw new Error("Invalid hex string length");
        }
        
        const array = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            array[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return array;
    }
    function uint8ArrayToHex(uint8) {
    return Array.from(uint8)
                    .map(b => b.toString(16).padStart(2, "0"))
                    .join("");
    }
    function b64Tou8(base64) {
    const buffer = Buffer.from(base64, 'base64');
        return new Uint8Array(buffer);
    }
    function u8ToB64(uint8Array) {
        return Buffer.from(uint8Array).toString('base64');
    }
    function unpackFloat(view, length, lsb) {
        if(view[1] + length > view[2]) throw(new Error("short buffer"));
        if(length != 4 && length != 8) throw(new Error("bad float"));
        ret = (length == 4) ? view[0].getFloat32(view[1],lsb) : view[0].getFloat64(view[1],lsb);
        view[1] += length;
        return ret;
    }
    function unpackInt(view, length, lsb) {
        if(view[1] + length > view[2]) throw(new Error("short buffer"));
        const off = view[1];
        view[1] += length;
        switch(length) {
            case 1: return view[0].getUint8(off,lsb);
            case 2: return view[0].getUint16(off,lsb);
            case 4: return view[0].getUint32(off,lsb);
            case 8: return view[0].getUint64(off,lsb);
        }
        throw(Error("bad int pack len"));
    }
    const TCID_STRUCT = 0;
    const TCID_HOMO_ARR = 1;
    const TCID_HET_ARR = 2;
    const TCID_UUID = 3;
    const TCID_UFORM = 4;
    const TCID_STRING = 5;
    const TCID_EFORM = 6;
    const TCID_MESSAGE = 7;
    const TCID_NULL = 8;
    const TCID_LSB_INT = 8;
    const TCID_TRUE = 9;
    const TCID_MSB_INT = 9;
    const TCID_FALSE = 10;
    const TCID_BOOL = 10;
    const TCID_LSB_FLOAT = 10;
    const TCID_MSB_FLOAT = 11;
    const TCID_ASCII = 12;
    const TCID_LSB_CHAR = 12;
    const TCID_MSB_CHAR = 13;
    const TCID_PAD = 14;
    const TCID_BIN = 15;
    const TCID_MIME = 16; //deprecated
    const TCID_TERMINAL = 17;
    const TCID_QUANTITY = 18;
    const TCID_ERRTOK = 19;
    const TCID_MIME2 = 20;
    const TCID_FRAGMENT = 21;
    const TCID_ISO8601 = 100;
    
    const textDecoder = new TextDecoder("utf-8");
    const textEncoder = new TextEncoder("utf-8");    
    const stringTC = [[0,-1,TCID_STRING]];
    const binTC = [[0,-1,TCID_BIN]];

    const ERRTOK = {"":["ErrTok"]};
    Object.freeze(ERRTOK);
    
    function bytesForFloat(n) {
        if (!Number.isFinite(n)) return 4; // NaN, Infinity fit in Float32
        let buf = new ArrayBuffer(4);
        let view = new DataView(buf);
        view.setFloat32(0, n, false);
        let back = view.getFloat32(0, false);
        return (back === n) ? 4 : 8;
    }
    
    class ByteWriter {
        constructor(initialSize = 1024) {
            this.buffer = new Uint8Array(initialSize);
            this.view = new DataView(this.buffer.buffer);
            this.offset = 0;
        }
        ensure(size) {
            if (this.offset + size <= this.buffer.byteLength) return;
            let newSize = this.buffer.byteLength;
            while (this.offset + size > newSize) {
                newSize *= 2;
            }
            let newBuf = new Uint8Array(newSize);
            newBuf.set(this.buffer); // copy old contents
            this.buffer = newBuf;
            this.view = new DataView(this.buffer.buffer);
        }
        putInt(val, n, lsb = false) {
            this.ensure(n);
            if(lsb) {
                while(n--) {
                    this.view.setUint8(this.offset++, val&0xff);
                    val >>=8;
                }
            } else {
                for(let i= this.offset + n; i > this.offset; i--) {
                    this.view.setUint8(i-1, val&0xff);
                    val >>= 8;
                }
                this.offset += n;
            }
        }
        putFloat(val, n, lsb = false) {
            this.ensure(n);
            switch(n) {
                case 4: this.view.setFloat32(this.offset, val); break;
                case 8: this.view.setFloat64(this.offset, val); break;
                default: throw Error("bad float len");
            }
            this.offset += n;
        }
        putEint(val) { //warning: only works w/ 32bits
            if(val < 0) throw(new Error("negative eint"));
            if(val < 0xfc) {
                this.putInt(val,1);
            }  else if(val <= 0x0ffff) {
                this.putInt(0xfc,1); this.putInt(val,2);
            } else {
                this.putInt(0xfd,1); this.putInt(val,4);
            }            
        }
        putBytes(bytes) {
            this.ensure(bytes.byteLength);
            this.buffer.set(bytes, this.offset);
            this.offset += bytes.byteLength;
        }
        toArrayBuffer() {
            return this.buffer.slice(0, this.offset); // trim
        }
    }    
    function getI(a, v, i) { return a.getIn ? a.getIn([v,i]) : a[v][i]; }
    function get(a,defa) {
        return getIn(a,Array.prototype.slice.call(arguments,1), defa);
    }
    function getIn(a,b,defa) {
        if(a.getIn) return a.getIn(b,defa);
        return b.reduce((ac,k) => {
            return (acc === undefined || acc === null) ? undefined : acc[key];
        }, a) ?? defa;
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
    function serialize(a)  {
        const buf = new ByteWriter();
        switch (typeof(a)) {
            case "boolean":
                buf.putInt(0x2a);
                buf.putInt(a ? 1 : 0);
                break;                    
            case "number":
            case "bigint":
                if((typeof a === "bigint") || (typeof a === "number" && Number.isInteger(a))) { //int
                    if(a >= -32768 && a < 32767) {
                        buf.putInt(0x49, 1);
                        buf.putInt(a, 2);
                    } else if(a >= -2147483648 && a <= 2147483647) {
                        buf.putInt(0x69, 1);                            
                        buf.putInt(a, 4);
                    } else {
                        throw(new Error("Not impl todo: int too big"));
                    }
                } else { //float
                    const lf = bytesForFloat(a);
                    buf.putInt(lf === 4 ? 0x6b : 0x8b, 1);
                    buf.putFloat(a, lf);
                }
                break;
            case "string":
                const bytes = textEncoder.encode(a);
                buf.putInt(0xA5,1);
                buf.putEint(bytes.byteLength);
                buf.putBytes(bytes);
                break;
            case "object":
                if(a === null) {
                    buf.putInt(0x08,1);
                } else if((Immutable && a instanceof Immutable.List) || Array.isArray(a)) {
                    buf.putInt(0xa2, 1);
                    if(((Immutable && a instanceof Immutable.List) ? a.size : a.length) > 0) {
                        const lbuf = new ByteWriter();
                        a.forEach((item, i) => {
                            const v = serialize(item);
                            //lbuf.putEint(v.byteLength);
                            lbuf.putBytes(v)
                        });
                        buf.putEint(lbuf.offset);
                        buf.putBytes(lbuf.toArrayBuffer());
                    } else {
                        buf.putEint(0);
                    }
                } else {
                    function serializeUUID(buf, uus) {
                        const bytes = (uus.slice(0,1) == '~') ? hexToUint8Array(uus.slice(1)) : textEncoder.encode(uus);
                        buf.putEint(bytes.byteLength);
                        buf.putBytes(bytes);
                    }
                    function serializeEform(buf, ef) {
                        ((Immutable && ef instanceof Immutable.Map) ? Array.from(ef.entries()) :
                         Object.entries(ef)).sort().forEach(kv => {
                            const [key,val] = kv;
                            const bytes = textEncoder.encode(key);
                            buf.putEint(bytes.byteLength);
                            buf.putBytes(bytes);
                            const vbytes = serialize(val);
                            buf.putEint(vbytes.byteLength);
                            buf.putBytes(vbytes);
                        });
                    }
                    const spc = isSpecial(a);
                    switch(spc) {
                        case "ErrTok":
                            buf.putInt(0x13,1);
                            break;
                        case "UUID":
                            buf.putInt(0xA3,1);
                            serializeUUID(buf, getI(a,'',1));
                            break;
                        case "UFORM":  //deprecated
                        case "UForm": {
                            const lbuf = new ByteWriter();
                            serializeUUID(lbuf, getI(a,'',1));
                            serializeEform(lbuf, getI(a,'',2));
                            buf.putInt(0xa4,1);
                            buf.putEint(lbuf.offset);
                            buf.putBytes(lbuf.toArrayBuffer());
                        } break;
                        case "Binary":
                        case "Quantity":
                        case "Message":
                        case "Pad": {
                            const bytes = b64Tou8(getI(a,'',2))
                            buf.putInt({"Binary":0xaf,
                                        "Quantity":0xb2,
                                        "Message":0xa7,
                                        "Pad":0xaed}[spc],1);                                
                            buf.putEint(bytes.byteLength);
                            buf.putBytes(bytes);
                        } break;
                        case "Date": {
                            const bytes = textEncoder.encode(getI(a,'',1));
                            buf.putInt(0xbf,1); buf.putInt(1,1); buf.putInt(100,1);
                            buf.putEint(bytes.byteLength);
                            buf.putBytes(bytes);
                        } break;
                        case "MimeVal":
                        case "MimeVal2": {
                            const tbytes = textEncoder.encode(getI(a,'',1));
                            const vbytes = textEncoder.encode(getI(a,'',2));
                            buf.putInt(spc == "MimeVal" ? 0xb0 : 0xb4,1);
                            buf.putEint(tbytes.byteLength);
                            buf.putBytes(tbytes);                                                        
                            if(spc == "MimeVal") buf.putEint(vbytes.byteLength);
                            buf.putBytes(vbytes);                            
                        } break;
                        case "Char":
                        case "Struct":
                        case "HArray":
                        case "Value":
                            todo();
                        default: {
                            //I guess attempt eform encode
                            const lbuf = new ByteWriter();
                            serializeEform(lbuf, a);
                            buf.putInt(0xa6,1);
                            buf.putEint(lbuf.offset);
                            buf.putBytes(lbuf.toArrayBuffer());
                        }
                    }
                }
                break;
            case "undefined":
            case "symbol":
            case "function":
            default: 
                throw(new Error("Not serializable: " + typeof a));
        }
        return buf.toArrayBuffer();
    }
    var vsmf = {
        require_optional: require_optional,
        NULL: null,
        ERRTOK: ERRTOK,
        isUForm: function(a) {
            return isSpecial(a)?.upper() === "UFORM";
        },
        isEForm: function(a) { //this is a little goofy
            return !isSpecial(a) && ((Immutable && Immutable.Map.isMap(a))||(!Immutable && typeof a == "object")) ;
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
            const ret = {"":["UUID",asString(a)]};
            Object.freeze(ret);
            return Immutable ? Immutable.fromJS(ret) : ret;
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
        Immutable: Immutable,
        
        // binary format functions
        serialize: serialize,
        deserialize: function(buffer, useImmutable = null, useFreeze = false) {
            if(useImmutable === null && Immutable) useImmutable = true; //default to true if loaded
            function getEint(view) {
                const b = getByte(view);
                if(b < 0xfc) return b;
                return getByteInt(view,(b === 0xfc) ? 2 : (b === 0xfd) ? 4 : (b === 0xfe) ? 8 : getEint(view));
            }
            function getByte(view) {
                if(view[1] >= view[2]) throw(new Error("short buffer"));
                return view[0].getUint8(view[1]++);
            }
            function getBytes(view, n) {
                if(view[1] + n > view[2]) throw(new Error("short buffer"));
                const ret = new Uint8Array(view[0].buffer, view[1], n);
                view[1] += n
                return ret;
            }
            function getBytesInt(view, n) { //arbitrary len but not fast
                if(view[1] + n > view[2]) throw(new Error("short buffer"));
                let ret = 0;
                while(n--) ret = (ret<<8) + getByte(view);
                return ret;
            }
            function parse(view) {
                const ret = parseType(parseTC(view),view);
                return ret;
            }
            function parseType(tc, view) {
                const [kind,tclength,id] = tc[0];
                const length = tclength == -1 ? getEint(view) : tclength;
                if(view[1] + length > view[2]) throw(new Error("short buffer"));                
                if(kind === 0) {
                    switch (id) {
                        case TCID_HET_ARR: {
                            const result = [];
                            const subview = [view[0],view[1],view[1]+length];
                            while(subview[1] < subview[2]) {
                                result.push(parse(subview));
                            }
                            view[1] += length;
                            return immute(result, useImmutable, useFreeze);
                        }
                        case TCID_UUID: {
                            const bytes = getBytes(view, length);
                            const uus = (bytes[0] > 31 && bytes[0] < 126) ? textDecoder.decode(bytes) : "~"+uint8ArrayToHex(bytes);
                            const ret = {"":["UUID", uus]};
                            return immute(ret, useImmutable, useFreeze);
                        }
                        case TCID_STRING:
                            return textDecoder.decode(getBytes(view, length));
                        case TCID_EFORM: {
                            const subview = [view[0],view[1],view[1]+length];
                            const ef = {};
                            while(subview[1] < subview[2]) {
                                const alen = getEint(subview);
                                const attr = textDecoder.decode(getBytes(subview, alen));
                                const valLen = getEint(subview);
                                ef[attr] = parse([subview[0],subview[1],subview[1] + valLen]);
                            }
                            view[1] += length;
                            return immute(ef, useImmutable, useFreeze);
                        }
                        case TCID_UFORM: {
                            const subview = [view[0],view[1],view[1]+length];
                            const e = getEint(subview);
                            const uubytes = getBytes(subview, e);
                            const uus = (uubytes[0] > 31 && uubytes[0] < 126) ? textDecoder.decode(uubytes) : "~"+uint8ArrayToHex(uubytes);
                            const ufd = {};
                            while(subview[1] < subview[2]) {
                                const alen = getEint(subview);
                                const attr = textDecoder.decode(getBytes(subview, alen));
                                const valLen = getEint(subview);
                                ufd[attr] = parse([subview[0],subview[1],subview[1] + valLen]);
                                subview[1] += valLen;
                            }
                            view[1] += length;
                            const ret= {"":["UForm", uus, ufd]};
                            return immute(ret, useImmutable, useFreeze);
                        }
                        case TCID_QUANTITY:
                            return immute({"":["Quantity", u8ToB64(getBytes(view, length))]}, useImmutable, useFreeze);
                        case TCID_MESSAGE:
                            return immute({"":["Message", u8ToB64(getBytes(view, length))]}, useImmutable, useFreeze);
                        case TCID_PAD:
                            return immute({"":["Pad", u8ToB64(getBytes(view, length))]}, useImmutable, useFreeze);  //todo: should this decode?
                        case TCID_BIN:
                            return immute({"":["Binary", u8ToB64(getBytes(view, length))]}, useImmutable, useFreeze);
                        case TCID_ISO8601:
                            return immute({"":["Date", textDecoder.decode(getBytes(view))]}, useImmutable, useFreeze);
                        case TCID_ERRTOK:
                            return ERRTOK;
                        case TCID_MSB_INT:
                            if(length == 0) return true; //legacy
                            return unpackInt(view,length, false);
                        case TCID_LSB_INT: //same: TCID_NULL:
                            return (length == 0) ? null : unpackInt(view,length, true);
                        case TCID_LSB_FLOAT:
                            if(length < 2) return length == 0 ? false : (getByte(view) != 0);
                            return unpackFloat(view, length, true);
                        case TCID_MSB_FLOAT:
                            if(length < 2) return length == 0 ? false : (getByte(view) != 0);
                            return unpackFloat(view, length, false);
                        case TCID_MIME:
                            return immute({"":["Mimeval",
                                               textDecoder.decode(getBytes(view, getEint(view))),                            
                                               u8ToB64(getBytes(view, getEint(view)))]}, useImmutable, useFreeze);
                        case TCID_MIME2:
                            const start = view[1];
                            return immute({"":["Mimeval2", 
                                               textDecoder.decode(getBytes(view, getEint(view))),
                                               u8ToB64(getBytes(view, length-(view[1]-start)))]}, useImmutable, useFreeze);
                        case TCID_ASCII:
                        case TCID_LSB_CHAR: {
                            const val = unpackInt(view, length, true);
                            return immute({"":["Char", val]}, useImmutable, useFreeze);
                        }
                        case TCID_MSB_CHAR: {
                            const val = unpackInt(view, length, false);
                            return immute({"":["Char", val]}, useImmutable, useFreeze);
                        }
                        default:
                            console.log("Warning: unimplemented value", tc); //todo?
                            return immute({"":["Value", tc, u8ToB64(getBytes(view, length))]}, useImmutable, useFreeze);
                    }
                } else { //kind > 0
                    if(cid == TCID_STRUCT) {
                        const ret = [];
                        for(const i=0; i<tc.length; i++) {
                            ret.push(parseType(tc[i], view));
                        }
                        return immute({"":["Struct", ret]}, useImmutable, useFreeze);
                    } else if(cid == TCID_HOMO_ARR) {
                        const subview = [view[0],view[1],view[1]+length];                        
                        if(tc.length != 2) throw(new Error("unsupported hom array"));
                        const memType = tc[1];
                        const ret = [];
                        if(memberType[0][1] === 0) { // size 0 exception
                            throw(new Error("nyi"));
                        }
                        while(subview[1] < subview[2]) {
                            ret.push(parseType(memType, subview));
                        }
                        view[1] += length;
                        return immute({"":["HArray", ret]}, useImmutable, useFreeze); // not sure this is right
                    } else {
                        return immute({"":["Value", tc, u8ToB64(getBytes(view, length))]}, useImmutable, useFreeze); //todo?
                    }
                }
            }
            function parseCodon(view) {
                const b1 = getByte(view);
                const abc = (b1 >> 5);
                const defgh = b1 & 0x1f;
                if(abc === 6) {
                    const length = (defgh >> 4) === 0 ? -1 : getEint(view);
                    const kind = ((defgh >> 3) & 1) === 0 ? 1 : getEint(view);
                    const cid = (defgh & 7) === 7 ? getBytesInt(view, getEint(view)) : (defgh & 7);
                    return [kind, length, cid];
                } else {
                    const length = abc === 7 ? getEint(view) : [0,1,2,4,8,-1][abc];
                    const cid = defgh === 0x1f ? getBytesInt(view, getEint(view)) : defgh;
                    return [0, length, cid];
                }
            }
            function parseTC(view) {
                const tc = [parseCodon(view)];
                for(j=0; j<tc[0][0]; j++) {
                    tc.push(parseTC(view));
                }
                return tc;
            }
            const realbuf = buffer instanceof Uint8Array ? buffer.buffer : buffer; //works on buffer or array
            const view = [new DataView(realbuf), 0, realbuf.byteLength];
            const ret = [];
            while(1) {
                const tc = parseTC(view);
                const before = view[1];
                const val = parseType(tc, view)
                ret.push(val);
                if(view[1] >= view[2]) break;
                if(view[1] <= before) throw(new Error("bad vsmf"));
            }
            if(ret.length === 1) return ret[0];
            return immute(ret, useImmutable, useFreeze); //vsmf implicit list assumption
        }
    }
    return vsmf;
}();

